import { randomUUID } from 'node:crypto';
import type { Logger } from '../../src/logger.js';

export function uniqueChannel(pattern: string): string {
  return `test-${pattern}-${randomUUID().slice(0, 8)}`;
}

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  msg: string;
  fields?: Record<string, unknown>;
}

export function createTestLogger(): Logger & { entries: LogEntry[] } {
  const entries: LogEntry[] = [];
  return {
    entries,
    debug(msg: string, fields?: Record<string, unknown>): void {
      entries.push({ level: 'debug', msg, fields });
    },
    info(msg: string, fields?: Record<string, unknown>): void {
      entries.push({ level: 'info', msg, fields });
    },
    warn(msg: string, fields?: Record<string, unknown>): void {
      entries.push({ level: 'warn', msg, fields });
    },
    error(msg: string, fields?: Record<string, unknown>): void {
      entries.push({ level: 'error', msg, fields });
    },
  };
}

export function createTestClientOptions(overrides?: Record<string, unknown>) {
  return {
    address: 'localhost:50000',
    clientId: `test-client-${randomUUID().slice(0, 8)}`,
    retry: {
      maxRetries: 0,
      initialBackoffMs: 10,
      maxBackoffMs: 100,
      multiplier: 2,
      jitter: 'none' as const,
    },
    ...overrides,
  };
}
