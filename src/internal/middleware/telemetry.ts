import type { Logger } from '../../logger.js';
import type { KubeMQError } from '../../errors.js';
import {
  INSTRUMENTATION_SCOPE_NAME,
  MESSAGING_SYSTEM,
  MESSAGING_SYSTEM_VALUE,
  MESSAGING_OPERATION_NAME,
  MESSAGING_OPERATION_TYPE,
  MESSAGING_DESTINATION_NAME,
  MESSAGING_MESSAGE_ID,
  MESSAGING_CLIENT_ID,
  MESSAGING_CONSUMER_GROUP_NAME,
  MESSAGING_BATCH_MESSAGE_COUNT,
  MESSAGING_MESSAGE_BODY_SIZE,
  SERVER_ADDRESS,
  SERVER_PORT,
  ERROR_TYPE,
  SPAN_EVENT_RETRY,
  ERROR_TYPE_MAP,
} from '../telemetry/attributes.js';

type OtelApi = typeof import('@opentelemetry/api');
type Tracer = import('@opentelemetry/api').Tracer;
type Span = import('@opentelemetry/api').Span;
type SpanKind = import('@opentelemetry/api').SpanKind;
type Context = import('@opentelemetry/api').Context;

export type OperationKind = 'publish' | 'process' | 'receive' | 'settle' | 'send';

export interface SpanConfig {
  operationName: OperationKind;
  channel: string;
  spanKind: SpanKind;
  clientId: string;
  serverAddress: string;
  serverPort: number;
  messageId?: string;
  consumerGroup?: string;
  bodySize?: number;
  batchCount?: number;
}

/**
 * Span configuration table (per GS REQ-OBS-1):
 *
 * | Operation                    | Span Kind | Span Name Format     |
 * |------------------------------|-----------|----------------------|
 * | Publish/Send (Events, ES, Q) | PRODUCER  | publish {channel}    |
 * | Subscribe callback           | CONSUMER  | process {channel}    |
 * | Queue Receive (pull)         | CONSUMER  | receive {channel}    |
 * | Queue Ack/Reject/Requeue     | CONSUMER  | settle {channel}     |
 * | Command/Query send           | CLIENT    | send {channel}       |
 * | Command/Query response       | SERVER    | process {channel}    |
 */

export class TelemetryMiddleware {
  private tracer: Tracer | undefined;
  private api: OtelApi | undefined;

  constructor(
    private readonly logger: Logger,
    private readonly sdkVersion: string,
  ) {}

  async lazyLoadApi(tracerProvider?: unknown): Promise<void> {
    if (this.api) return;
    try {
      this.api = await import('@opentelemetry/api');
      const provider = tracerProvider as import('@opentelemetry/api').TracerProvider | undefined;
      this.tracer = (provider ?? this.api.trace.getTracerProvider()).getTracer(
        INSTRUMENTATION_SCOPE_NAME,
        this.sdkVersion,
      );
      this.logger.debug('OpenTelemetry tracing initialized', {
        scope: INSTRUMENTATION_SCOPE_NAME,
        version: this.sdkVersion,
      });
    } catch {
      this.logger.debug('OpenTelemetry API not available — tracing disabled');
      this.api = undefined;
      this.tracer = undefined;
    }
  }

  get isEnabled(): boolean {
    return this.tracer !== undefined;
  }

  startSpan(config: SpanConfig, parentContext?: Context): Span | undefined {
    if (!this.tracer || !this.api) return undefined;

    const spanName = `${config.operationName} ${config.channel}`;
    const ctx = parentContext ?? this.api.context.active();

    const span = this.tracer.startSpan(
      spanName,
      {
        kind: config.spanKind,
        attributes: {
          [MESSAGING_SYSTEM]: MESSAGING_SYSTEM_VALUE,
          [MESSAGING_OPERATION_NAME]: config.operationName,
          [MESSAGING_OPERATION_TYPE]: config.operationName,
          [MESSAGING_DESTINATION_NAME]: config.channel,
          [MESSAGING_CLIENT_ID]: config.clientId,
          [SERVER_ADDRESS]: config.serverAddress,
          [SERVER_PORT]: config.serverPort,
        },
      },
      ctx,
    );

    if (span.isRecording()) {
      if (config.messageId) {
        span.setAttribute(MESSAGING_MESSAGE_ID, config.messageId);
      }
      if (config.consumerGroup) {
        span.setAttribute(MESSAGING_CONSUMER_GROUP_NAME, config.consumerGroup);
      }
      if (config.bodySize !== undefined) {
        span.setAttribute(MESSAGING_MESSAGE_BODY_SIZE, config.bodySize);
      }
      if (config.batchCount !== undefined) {
        span.setAttribute(MESSAGING_BATCH_MESSAGE_COUNT, config.batchCount);
      }
    }

    return span;
  }

  endSpan(span: Span | undefined, error?: KubeMQError): void {
    if (!span || !this.api) return;

    if (error) {
      span.setStatus({
        code: this.api.SpanStatusCode.ERROR,
        message: error.message,
      });
      if (span.isRecording()) {
        const errorTypeValue = ERROR_TYPE_MAP[error.category] ?? 'fatal';
        span.setAttribute(ERROR_TYPE, errorTypeValue);
      }
    } else {
      span.setStatus({ code: this.api.SpanStatusCode.OK });
    }

    span.end();
  }

  addRetryEvent(
    span: Span | undefined,
    attempt: number,
    delaySeconds: number,
    errorType: string,
  ): void {
    if (!span?.isRecording()) return;

    span.addEvent(SPAN_EVENT_RETRY, {
      'retry.attempt': attempt,
      'retry.delay_seconds': delaySeconds,
      [ERROR_TYPE]: errorType,
    });
  }

  getApi(): OtelApi | undefined {
    return this.api;
  }

  getContext(): Context | undefined {
    return this.api?.context.active();
  }
}
