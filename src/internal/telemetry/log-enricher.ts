import type { Logger } from '../../logger.js';

type OtelApi = typeof import('@opentelemetry/api');

/**
 * Wraps a Logger to automatically inject OTel trace context (trace_id, span_id)
 * into log fields when available. Falls back to the raw logger when OTel is not loaded.
 */
export function createTraceEnrichedLogger(
  baseLogger: Logger,
  getOtelApi: () => OtelApi | undefined,
): Logger {
  function enrichFields(fields?: Record<string, unknown>): Record<string, unknown> | undefined {
    const api = getOtelApi();
    if (!api) return fields;

    const span = api.trace.getActiveSpan();
    if (!span) return fields;

    const ctx = span.spanContext();
    if (!api.isSpanContextValid(ctx)) return fields;

    return {
      ...fields,
      trace_id: ctx.traceId,
      span_id: ctx.spanId,
    };
  }

  return {
    debug(msg, fields) {
      baseLogger.debug(msg, enrichFields(fields));
    },
    info(msg, fields) {
      baseLogger.info(msg, enrichFields(fields));
    },
    warn(msg, fields) {
      baseLogger.warn(msg, enrichFields(fields));
    },
    error(msg, fields) {
      baseLogger.error(msg, enrichFields(fields));
    },
  };
}
