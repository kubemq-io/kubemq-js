import { describe, it, expect, vi } from 'vitest';
import { createTraceEnrichedLogger } from '../../src/internal/telemetry/log-enricher.js';

function createMockLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe('createTraceEnrichedLogger', () => {
  it('passes through logs when OTel API is unavailable', () => {
    const base = createMockLogger();
    const enriched = createTraceEnrichedLogger(base, () => undefined);

    enriched.info('hello', { key: 'value' });

    expect(base.info).toHaveBeenCalledWith('hello', { key: 'value' });
  });

  it('passes through when no active span', () => {
    const base = createMockLogger();
    const mockApi = {
      trace: { getActiveSpan: () => undefined },
    };
    const enriched = createTraceEnrichedLogger(base, () => mockApi as never);

    enriched.debug('test');

    expect(base.debug).toHaveBeenCalledWith('test', undefined);
  });

  it('passes through when span context is invalid', () => {
    const base = createMockLogger();
    const mockApi = {
      trace: {
        getActiveSpan: () => ({
          spanContext: () => ({ traceId: '0', spanId: '0' }),
        }),
      },
      isSpanContextValid: () => false,
    };
    const enriched = createTraceEnrichedLogger(base, () => mockApi as never);

    enriched.warn('warning', { extra: true });

    expect(base.warn).toHaveBeenCalledWith('warning', { extra: true });
  });

  it('enriches fields with trace_id and span_id when span is active', () => {
    const base = createMockLogger();
    const mockApi = {
      trace: {
        getActiveSpan: () => ({
          spanContext: () => ({
            traceId: 'abc123',
            spanId: 'def456',
          }),
        }),
      },
      isSpanContextValid: () => true,
    };
    const enriched = createTraceEnrichedLogger(base, () => mockApi as never);

    enriched.info('enriched message');

    expect(base.info).toHaveBeenCalledWith('enriched message', {
      trace_id: 'abc123',
      span_id: 'def456',
    });
  });

  it('preserves existing fields while adding trace context', () => {
    const base = createMockLogger();
    const mockApi = {
      trace: {
        getActiveSpan: () => ({
          spanContext: () => ({
            traceId: 'trace-1',
            spanId: 'span-1',
          }),
        }),
      },
      isSpanContextValid: () => true,
    };
    const enriched = createTraceEnrichedLogger(base, () => mockApi as never);

    enriched.error('fail', { operation: 'send', code: 500 });

    expect(base.error).toHaveBeenCalledWith('fail', {
      operation: 'send',
      code: 500,
      trace_id: 'trace-1',
      span_id: 'span-1',
    });
  });

  it('delegates all four log levels', () => {
    const base = createMockLogger();
    const enriched = createTraceEnrichedLogger(base, () => undefined);

    enriched.debug('d');
    enriched.info('i');
    enriched.warn('w');
    enriched.error('e');

    expect(base.debug).toHaveBeenCalledWith('d', undefined);
    expect(base.info).toHaveBeenCalledWith('i', undefined);
    expect(base.warn).toHaveBeenCalledWith('w', undefined);
    expect(base.error).toHaveBeenCalledWith('e', undefined);
  });
});
