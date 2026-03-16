/**
 * Structured logging interface. Users inject their preferred logger
 * (pino, winston, bunyan, etc.) via ClientOptions.
 *
 * Default: noopLogger — zero output unless configured.
 */
export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
}

/** Structured key-value context attached to log entries. */
export type LogContext = Record<string, unknown>;

/** Log severity levels. 'off' disables all output. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'off';

/**
 * Default no-op logger. All methods are empty — zero overhead,
 * zero output. Users replace this via ClientOptions.logger.
 */
export const noopLogger: Logger = {
  debug() {
    /* noop */
  },
  info() {
    /* noop */
  },
  warn() {
    /* noop */
  },
  error() {
    /* noop */
  },
};

const LOG_LEVEL_PRIORITY: Readonly<Record<LogLevel, number>> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  off: 4,
};

/**
 * Creates a console-based logger filtered by level.
 * Intended for development/debugging — NOT used internally by the SDK.
 *
 * @example
 * ```ts
 * import { createConsoleLogger } from 'kubemq-js';
 *
 * const client = await KubeMQClient.create({
 *   address: 'localhost:50000',
 *   logger: createConsoleLogger('debug'),
 * });
 * ```
 */
export function createConsoleLogger(level: LogLevel): Logger {
  if (level === 'off') {
    return noopLogger;
  }

  const threshold = LOG_LEVEL_PRIORITY[level];

  function emit(
    severity: Exclude<LogLevel, 'off'>,
    consoleFn: (...args: unknown[]) => void,
    msg: string,
    fields?: LogContext,
  ): void {
    if (LOG_LEVEL_PRIORITY[severity] < threshold) {
      return;
    }
    if (fields !== undefined && Object.keys(fields).length > 0) {
      consoleFn(`[${severity.toUpperCase()}] ${msg}`, fields);
    } else {
      consoleFn(`[${severity.toUpperCase()}] ${msg}`);
    }
  }

  return {
    /* eslint-disable no-console */
    debug(msg: string, fields?: LogContext): void {
      emit('debug', console.debug, msg, fields);
    },
    info(msg: string, fields?: LogContext): void {
      emit('info', console.info, msg, fields);
    },
    warn(msg: string, fields?: LogContext): void {
      emit('warn', console.warn, msg, fields);
    },
    error(msg: string, fields?: LogContext): void {
      emit('error', console.error, msg, fields);
    },
    /* eslint-enable no-console */
  };
}
