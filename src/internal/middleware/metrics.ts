import type { Logger } from '../../logger.js';
import {
  INSTRUMENTATION_SCOPE_NAME,
  MESSAGING_SYSTEM,
  MESSAGING_SYSTEM_VALUE,
  MESSAGING_OPERATION_NAME,
  MESSAGING_DESTINATION_NAME,
  ERROR_TYPE,
  METRIC_OPERATION_DURATION,
  METRIC_SENT_MESSAGES,
  METRIC_CONSUMED_MESSAGES,
  METRIC_CONNECTION_COUNT,
  METRIC_RECONNECTIONS,
  METRIC_RETRY_ATTEMPTS,
  METRIC_RETRY_EXHAUSTED,
  DURATION_HISTOGRAM_BOUNDARIES,
} from '../telemetry/attributes.js';

type OtelApi = typeof import('@opentelemetry/api');
type Meter = import('@opentelemetry/api').Meter;
type Counter = import('@opentelemetry/api').Counter;
type UpDownCounter = import('@opentelemetry/api').UpDownCounter;
type Histogram = import('@opentelemetry/api').Histogram;

export interface CardinalityConfig {
  maxChannelNames: number;
  channelAllowlist: Set<string>;
}

export interface MetricAttributes {
  operationName: string;
  channel?: string;
  errorType?: string;
}

export class MetricsMiddleware {
  private meter: Meter | undefined;
  private api: OtelApi | undefined;

  private operationDuration: Histogram | undefined;
  private sentMessages: Counter | undefined;
  private consumedMessages: Counter | undefined;
  private connectionCount: UpDownCounter | undefined;
  private reconnections: Counter | undefined;
  private retryAttempts: Counter | undefined;
  private retryExhausted: Counter | undefined;

  private seenChannels = new Set<string>();
  private cardinalityWarned = false;

  constructor(
    private readonly logger: Logger,
    private readonly sdkVersion: string,
    private readonly cardinalityConfig: CardinalityConfig = {
      maxChannelNames: 100,
      channelAllowlist: new Set(),
    },
  ) {}

  async lazyLoadApi(meterProvider?: unknown): Promise<void> {
    if (this.api) return;
    try {
      this.api = await import('@opentelemetry/api');
      const provider = meterProvider as import('@opentelemetry/api').MeterProvider | undefined;
      this.meter = (provider ?? this.api.metrics.getMeterProvider()).getMeter(
        INSTRUMENTATION_SCOPE_NAME,
        this.sdkVersion,
      );
      this.initInstruments();
      this.logger.debug('OpenTelemetry metrics initialized', {
        scope: INSTRUMENTATION_SCOPE_NAME,
        version: this.sdkVersion,
      });
    } catch {
      this.logger.debug('OpenTelemetry API not available — metrics disabled');
      this.api = undefined;
      this.meter = undefined;
    }
  }

  private initInstruments(): void {
    if (!this.meter) return;

    this.operationDuration = this.meter.createHistogram(METRIC_OPERATION_DURATION, {
      description: 'Duration of each messaging operation',
      unit: 's',
      advice: {
        explicitBucketBoundaries: [...DURATION_HISTOGRAM_BOUNDARIES],
      },
    });

    this.sentMessages = this.meter.createCounter(METRIC_SENT_MESSAGES, {
      description: 'Total messages sent',
      unit: '{message}',
    });

    this.consumedMessages = this.meter.createCounter(METRIC_CONSUMED_MESSAGES, {
      description: 'Total messages consumed',
      unit: '{message}',
    });

    this.connectionCount = this.meter.createUpDownCounter(METRIC_CONNECTION_COUNT, {
      description: 'Active connections',
      unit: '{connection}',
    });

    this.reconnections = this.meter.createCounter(METRIC_RECONNECTIONS, {
      description: 'Reconnection attempts',
      unit: '{attempt}',
    });

    this.retryAttempts = this.meter.createCounter(METRIC_RETRY_ATTEMPTS, {
      description: 'Retry attempts',
      unit: '{attempt}',
    });

    this.retryExhausted = this.meter.createCounter(METRIC_RETRY_EXHAUSTED, {
      description: 'Retries exhausted',
      unit: '{attempt}',
    });
  }

  get isEnabled(): boolean {
    return this.meter !== undefined;
  }

  private resolveAttributes(attrs: MetricAttributes): Record<string, string> {
    const result: Record<string, string> = {
      [MESSAGING_SYSTEM]: MESSAGING_SYSTEM_VALUE,
      [MESSAGING_OPERATION_NAME]: attrs.operationName,
    };

    if (attrs.channel) {
      const include = this.shouldIncludeChannel(attrs.channel);
      if (include) {
        result[MESSAGING_DESTINATION_NAME] = attrs.channel;
      }
    }

    if (attrs.errorType) {
      result[ERROR_TYPE] = attrs.errorType;
    }

    return result;
  }

  private shouldIncludeChannel(channel: string): boolean {
    if (this.cardinalityConfig.channelAllowlist.has(channel)) {
      return true;
    }

    if (this.seenChannels.has(channel)) {
      return true;
    }

    if (this.seenChannels.size < this.cardinalityConfig.maxChannelNames) {
      this.seenChannels.add(channel);
      return true;
    }

    if (!this.cardinalityWarned) {
      this.cardinalityWarned = true;
      this.logger.warn(
        'Metric cardinality threshold exceeded — omitting channel name from new metric series',
        {
          threshold: this.cardinalityConfig.maxChannelNames,
          uniqueChannels: this.seenChannels.size,
        },
      );
    }

    return false;
  }

  // ─── Recording Methods ──────────────────────────────────────────

  recordOperationDuration(durationSeconds: number, attrs: MetricAttributes): void {
    this.operationDuration?.record(durationSeconds, this.resolveAttributes(attrs));
  }

  recordMessageSent(attrs: MetricAttributes, count = 1): void {
    this.sentMessages?.add(count, this.resolveAttributes(attrs));
  }

  recordMessageConsumed(attrs: MetricAttributes, count = 1): void {
    this.consumedMessages?.add(count, this.resolveAttributes(attrs));
  }

  recordConnectionChange(delta: 1 | -1): void {
    this.connectionCount?.add(delta, {
      [MESSAGING_SYSTEM]: MESSAGING_SYSTEM_VALUE,
    });
  }

  recordReconnectionAttempt(): void {
    this.reconnections?.add(1, {
      [MESSAGING_SYSTEM]: MESSAGING_SYSTEM_VALUE,
    });
  }

  recordRetryAttempt(attrs: MetricAttributes): void {
    this.retryAttempts?.add(1, this.resolveAttributes(attrs));
  }

  recordRetryExhausted(attrs: MetricAttributes): void {
    this.retryExhausted?.add(1, this.resolveAttributes(attrs));
  }
}
