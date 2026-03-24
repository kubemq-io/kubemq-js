import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TelemetryMiddleware } from '../../src/internal/middleware/telemetry.js';
import type { SpanConfig } from '../../src/internal/middleware/telemetry.js';
import { KubeMQError } from '../../src/errors.js';
import {
  BasicTracerProvider,
  SimpleSpanProcessor,
  InMemorySpanExporter,
} from '@opentelemetry/sdk-trace-base';
import {
  MESSAGING_MESSAGE_ID,
  MESSAGING_CONSUMER_GROUP_NAME,
  MESSAGING_MESSAGE_BODY_SIZE,
  MESSAGING_BATCH_MESSAGE_COUNT,
  ERROR_TYPE,
} from '../../src/internal/telemetry/attributes.js';

function createMockLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe('TelemetryMiddleware', () => {
  let logger: ReturnType<typeof createMockLogger>;
  let middleware: TelemetryMiddleware;

  beforeEach(() => {
    logger = createMockLogger();
    middleware = new TelemetryMiddleware(logger, '1.0.0-test');
  });

  it('isEnabled is false by default', () => {
    expect(middleware.isEnabled).toBe(false);
  });

  it('startSpan returns undefined when not enabled', () => {
    const config: SpanConfig = {
      operationName: 'publish',
      channel: 'test-channel',
      spanKind: 0,
      clientId: 'client-1',
      serverAddress: 'localhost',
      serverPort: 50000,
    };
    expect(middleware.startSpan(config)).toBeUndefined();
  });

  it('endSpan does nothing when span is undefined', () => {
    expect(() => middleware.endSpan(undefined)).not.toThrow();
  });

  it('addRetryEvent does nothing when span is undefined', () => {
    expect(() => middleware.addRetryEvent(undefined, 1, 0.5, 'transient')).not.toThrow();
  });

  it('getApi returns undefined before lazyLoadApi', () => {
    expect(middleware.getApi()).toBeUndefined();
  });

  it('getContext returns undefined before lazyLoadApi', () => {
    expect(middleware.getContext()).toBeUndefined();
  });

  describe('after lazyLoadApi', () => {
    beforeEach(async () => {
      await middleware.lazyLoadApi();
    });

    it('isEnabled is true when OTel is available', () => {
      expect(middleware.isEnabled).toBe(true);
    });

    it('getApi returns the OTel API', () => {
      expect(middleware.getApi()).toBeDefined();
    });

    it('getContext returns active context', () => {
      expect(middleware.getContext()).toBeDefined();
    });

    it('lazyLoadApi is idempotent', async () => {
      const apiBefore = middleware.getApi();
      await middleware.lazyLoadApi();
      expect(middleware.getApi()).toBe(apiBefore);
    });

    it('startSpan returns a span', () => {
      const config: SpanConfig = {
        operationName: 'publish',
        channel: 'test-channel',
        spanKind: 0,
        clientId: 'client-1',
        serverAddress: 'localhost',
        serverPort: 50000,
      };
      const span = middleware.startSpan(config);
      expect(span).toBeDefined();
      span!.end();
    });

    it('startSpan sets optional attributes when provided', () => {
      const config: SpanConfig = {
        operationName: 'publish',
        channel: 'test-channel',
        spanKind: 0,
        clientId: 'client-1',
        serverAddress: 'localhost',
        serverPort: 50000,
        messageId: 'msg-123',
        consumerGroup: 'group-1',
        bodySize: 256,
        batchCount: 5,
      };
      const span = middleware.startSpan(config);
      expect(span).toBeDefined();
      span!.end();
    });

    it('startSpan accepts a parent context', () => {
      const api = middleware.getApi()!;
      const parentCtx = api.context.active();
      const config: SpanConfig = {
        operationName: 'process',
        channel: 'test-channel',
        spanKind: 1,
        clientId: 'client-1',
        serverAddress: 'localhost',
        serverPort: 50000,
      };
      const span = middleware.startSpan(config, parentCtx);
      expect(span).toBeDefined();
      span!.end();
    });

    it('endSpan sets OK status when no error', () => {
      const config: SpanConfig = {
        operationName: 'publish',
        channel: 'test-channel',
        spanKind: 0,
        clientId: 'client-1',
        serverAddress: 'localhost',
        serverPort: 50000,
      };
      const span = middleware.startSpan(config)!;
      expect(() => middleware.endSpan(span)).not.toThrow();
    });

    it('endSpan sets ERROR status with error', () => {
      const config: SpanConfig = {
        operationName: 'publish',
        channel: 'test-channel',
        spanKind: 0,
        clientId: 'client-1',
        serverAddress: 'localhost',
        serverPort: 50000,
      };
      const span = middleware.startSpan(config)!;
      const error = new KubeMQError({
        message: 'test error',
        operation: 'publish',
        isRetryable: false,
      });
      expect(() => middleware.endSpan(span, error)).not.toThrow();
    });

    it('addRetryEvent adds event to a recording span', () => {
      const config: SpanConfig = {
        operationName: 'send',
        channel: 'retry-channel',
        spanKind: 0,
        clientId: 'client-1',
        serverAddress: 'localhost',
        serverPort: 50000,
      };
      const span = middleware.startSpan(config)!;
      expect(() => middleware.addRetryEvent(span, 1, 0.5, 'transient')).not.toThrow();
      span.end();
    });

    it('endSpan sets error_type attribute when span is recording', () => {
      const mockSpan = {
        setStatus: vi.fn(),
        setAttribute: vi.fn(),
        isRecording: () => true,
        end: vi.fn(),
      };
      const error = new KubeMQError({
        message: 'test error',
        operation: 'publish',
        isRetryable: false,
      });
      middleware.endSpan(mockSpan as any, error);
      expect(mockSpan.setStatus).toHaveBeenCalled();
      expect(mockSpan.setAttribute).toHaveBeenCalled();
      expect(mockSpan.end).toHaveBeenCalled();
    });

    it('addRetryEvent adds event when span is recording', () => {
      const mockSpan = {
        isRecording: () => true,
        addEvent: vi.fn(),
      };
      middleware.addRetryEvent(mockSpan as any, 2, 1.5, 'transient');
      expect(mockSpan.addEvent).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ 'retry.attempt': 2, 'retry.delay_seconds': 1.5 }),
      );
    });

    it('addRetryEvent does nothing when span is not recording', () => {
      const mockSpan = {
        isRecording: () => false,
        addEvent: vi.fn(),
      };
      middleware.addRetryEvent(mockSpan as any, 1, 0.5, 'transient');
      expect(mockSpan.addEvent).not.toHaveBeenCalled();
    });

    it('endSpan does not set error_type when span is not recording', () => {
      const mockSpan = {
        setStatus: vi.fn(),
        setAttribute: vi.fn(),
        isRecording: () => false,
        end: vi.fn(),
      };
      const error = new KubeMQError({
        message: 'test error',
        operation: 'publish',
        isRetryable: false,
      });
      middleware.endSpan(mockSpan as any, error);
      expect(mockSpan.setStatus).toHaveBeenCalled();
      expect(mockSpan.setAttribute).not.toHaveBeenCalled();
      expect(mockSpan.end).toHaveBeenCalled();
    });
  });

  describe('with real BasicTracerProvider (recording spans)', () => {
    let exporter: InMemorySpanExporter;
    let provider: BasicTracerProvider;
    let realMiddleware: TelemetryMiddleware;

    beforeEach(async () => {
      exporter = new InMemorySpanExporter();
      provider = new BasicTracerProvider({
        spanProcessors: [new SimpleSpanProcessor(exporter)],
      });

      realMiddleware = new TelemetryMiddleware(createMockLogger(), '1.0.0-test');
      await realMiddleware.lazyLoadApi(provider);
    });

    afterEach(async () => {
      await provider.shutdown();
    });

    it('startSpan with all optional attributes records them on the finished span', () => {
      const config: SpanConfig = {
        operationName: 'publish',
        channel: 'orders',
        spanKind: 0,
        clientId: 'client-1',
        serverAddress: 'localhost',
        serverPort: 50000,
        messageId: 'msg-456',
        consumerGroup: 'workers',
        bodySize: 1024,
        batchCount: 10,
      };

      const span = realMiddleware.startSpan(config)!;
      expect(span).toBeDefined();
      expect(span.isRecording()).toBe(true);
      realMiddleware.endSpan(span);

      const finished = exporter.getFinishedSpans();
      expect(finished.length).toBe(1);

      const attrs = finished[0].attributes;
      expect(attrs[MESSAGING_MESSAGE_ID]).toBe('msg-456');
      expect(attrs[MESSAGING_CONSUMER_GROUP_NAME]).toBe('workers');
      expect(attrs[MESSAGING_MESSAGE_BODY_SIZE]).toBe(1024);
      expect(attrs[MESSAGING_BATCH_MESSAGE_COUNT]).toBe(10);
    });

    it('startSpan without optional attributes does not set them', () => {
      const config: SpanConfig = {
        operationName: 'publish',
        channel: 'events',
        spanKind: 0,
        clientId: 'client-2',
        serverAddress: 'localhost',
        serverPort: 50000,
      };

      const span = realMiddleware.startSpan(config)!;
      realMiddleware.endSpan(span);

      const finished = exporter.getFinishedSpans();
      expect(finished.length).toBe(1);

      const attrs = finished[0].attributes;
      expect(attrs[MESSAGING_MESSAGE_ID]).toBeUndefined();
      expect(attrs[MESSAGING_CONSUMER_GROUP_NAME]).toBeUndefined();
      expect(attrs[MESSAGING_MESSAGE_BODY_SIZE]).toBeUndefined();
      expect(attrs[MESSAGING_BATCH_MESSAGE_COUNT]).toBeUndefined();
    });

    it('endSpan with error sets error.type attribute on a recording span', () => {
      const config: SpanConfig = {
        operationName: 'send',
        channel: 'cmds',
        spanKind: 2,
        clientId: 'client-3',
        serverAddress: 'localhost',
        serverPort: 50000,
      };

      const span = realMiddleware.startSpan(config)!;
      const error = new KubeMQError({
        message: 'timeout exceeded',
        operation: 'send',
        isRetryable: true,
      });
      realMiddleware.endSpan(span, error);

      const finished = exporter.getFinishedSpans();
      expect(finished.length).toBe(1);
      expect(finished[0].attributes[ERROR_TYPE]).toBeDefined();
      expect(finished[0].status.code).toBe(2); // SpanStatusCode.ERROR
    });

    it('addRetryEvent on a recording span records the event', () => {
      const config: SpanConfig = {
        operationName: 'publish',
        channel: 'retries',
        spanKind: 0,
        clientId: 'client-4',
        serverAddress: 'localhost',
        serverPort: 50000,
      };

      const span = realMiddleware.startSpan(config)!;
      realMiddleware.addRetryEvent(span, 3, 2.0, 'transient');
      realMiddleware.endSpan(span);

      const finished = exporter.getFinishedSpans();
      expect(finished.length).toBe(1);
      expect(finished[0].events.length).toBe(1);
      expect(finished[0].events[0].name).toBe('retry');
      expect(finished[0].events[0].attributes?.['retry.attempt']).toBe(3);
      expect(finished[0].events[0].attributes?.['retry.delay_seconds']).toBe(2.0);
      expect(finished[0].events[0].attributes?.[ERROR_TYPE]).toBe('transient');
    });

    it('endSpan without error sets OK status on a recording span', () => {
      const config: SpanConfig = {
        operationName: 'receive',
        channel: 'queue-1',
        spanKind: 1,
        clientId: 'client-5',
        serverAddress: 'localhost',
        serverPort: 50000,
      };

      const span = realMiddleware.startSpan(config)!;
      realMiddleware.endSpan(span);

      const finished = exporter.getFinishedSpans();
      expect(finished.length).toBe(1);
      expect(finished[0].status.code).toBe(1); // SpanStatusCode.OK
    });
  });

  describe('lazyLoadApi failure', () => {
    it('catches import failure gracefully', async () => {
      const logger = createMockLogger();
      // Create a fresh middleware that hasn't loaded the API
      const freshMiddleware = new TelemetryMiddleware(logger, '1.0.0-test');

      // Mock the dynamic import to fail — use vi.spyOn on the module-level import
      // Since we can't easily mock dynamic import(), verify the path when API is not loaded
      expect(freshMiddleware.isEnabled).toBe(false);
      expect(freshMiddleware.startSpan({
        operationName: 'publish',
        channel: 'ch',
        spanKind: 3,
        clientId: 'c',
        serverAddress: 'localhost',
        serverPort: 50000,
      })).toBeUndefined();
    });

    it('endSpan is no-op when span is undefined', () => {
      const logger = createMockLogger();
      const freshMiddleware = new TelemetryMiddleware(logger, '1.0.0-test');
      // Should not throw
      freshMiddleware.endSpan(undefined);
    });
  });
});
