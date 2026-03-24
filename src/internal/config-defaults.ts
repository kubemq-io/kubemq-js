/** @internal */

import { randomUUID } from 'node:crypto';
import type {
  ClientOptions,
  KeepaliveOptions,
  RetryPolicy,
  ReconnectionPolicy,
  TlsOptions,
} from '../options.js';
import type { Logger } from '../logger.js';
import { noopLogger } from '../logger.js';
import {
  DEFAULT_CONNECTION_TIMEOUT_MS,
  DEFAULT_MAX_MESSAGE_SIZE,
  DEFAULT_RECONNECT_BUFFER_SIZE,
  DEFAULT_SEND_TIMEOUT_MS,
  DEFAULT_SUBSCRIBE_TIMEOUT_MS,
  DEFAULT_RPC_TIMEOUT_MS,
  DEFAULT_QUEUE_RECEIVE_TIMEOUT_MS,
  DEFAULT_QUEUE_POLL_TIMEOUT_MS,
  DEFAULT_MAX_CONCURRENT_RETRIES,
} from '../options.js';

/**
 * Fully-resolved configuration after defaults are applied.
 * Unlike `Required<ClientOptions>`, `credentials`, `tracerProvider`,
 * and `meterProvider` remain optional (no sensible non-undefined default).
 */
export interface ResolvedClientOptions {
  readonly address: string;
  readonly clientId: string;
  readonly credentials: ClientOptions['credentials'] | undefined;
  readonly tls: boolean | TlsOptions;
  readonly keepalive: Readonly<Required<KeepaliveOptions>>;
  readonly retry: Readonly<Required<RetryPolicy>>;
  readonly reconnect: Readonly<Required<ReconnectionPolicy>>;
  readonly connectionTimeoutMs: number;
  readonly maxReceiveMessageSize: number;
  readonly maxSendMessageSize: number;
  readonly waitForReady: boolean;
  readonly logger: Logger;
  readonly tracerProvider: unknown;
  readonly meterProvider: unknown;
  readonly reconnectBufferSize: number;
  readonly reconnectBufferMode: 'error' | 'block';
  readonly maxConcurrentRetries: number;
  readonly defaultSendTimeoutMs: number;
  readonly defaultSubscribeTimeoutMs: number;
  readonly defaultRpcTimeoutMs: number;
  readonly defaultQueueReceiveTimeoutMs: number;
  readonly defaultQueuePollTimeoutMs: number;
}

/**
 * Apply sensible defaults to user-provided options, producing a
 * fully-resolved, internally-immutable configuration object.
 *
 * TLS defaults to `false` for localhost addresses, `true` for remote.
 */
export function applyDefaults(options: ClientOptions): ResolvedClientOptions {
  return {
    address: options.address,
    clientId: options.clientId ?? randomUUID(),
    credentials: options.credentials ?? undefined,
    tls: resolveTlsDefault(options),
    keepalive: {
      timeMs: 10_000,
      timeoutMs: 5_000,
      permitWithoutCalls: true,
      ...options.keepalive,
    },
    retry: {
      maxRetries: 3,
      initialBackoffMs: 500,
      maxBackoffMs: 30_000,
      multiplier: 2.0,
      jitter: 'full' as const,
      ...options.retry,
    },
    reconnect: {
      maxAttempts: -1,
      initialDelayMs: 500,
      maxDelayMs: 30_000,
      multiplier: 2.0,
      jitter: 'full' as const,
      ...options.reconnect,
    },
    connectionTimeoutMs:
      options.connectionTimeoutSeconds != null
        ? options.connectionTimeoutSeconds * 1000
        : DEFAULT_CONNECTION_TIMEOUT_MS,
    maxReceiveMessageSize: options.maxReceiveMessageSize ?? DEFAULT_MAX_MESSAGE_SIZE,
    maxSendMessageSize: options.maxSendMessageSize ?? DEFAULT_MAX_MESSAGE_SIZE,
    waitForReady: options.waitForReady ?? true,
    logger: options.logger ?? noopLogger,
    tracerProvider: options.tracerProvider ?? undefined,
    meterProvider: options.meterProvider ?? undefined,
    reconnectBufferSize: options.reconnectBufferSize ?? DEFAULT_RECONNECT_BUFFER_SIZE,
    reconnectBufferMode: options.reconnectBufferMode ?? 'error',
    maxConcurrentRetries: options.maxConcurrentRetries ?? DEFAULT_MAX_CONCURRENT_RETRIES,
    defaultSendTimeoutMs:
      options.defaultSendTimeoutSeconds != null
        ? options.defaultSendTimeoutSeconds * 1000
        : DEFAULT_SEND_TIMEOUT_MS,
    defaultSubscribeTimeoutMs:
      options.defaultSubscribeTimeoutSeconds != null
        ? options.defaultSubscribeTimeoutSeconds * 1000
        : DEFAULT_SUBSCRIBE_TIMEOUT_MS,
    defaultRpcTimeoutMs:
      options.defaultRpcTimeoutSeconds != null
        ? options.defaultRpcTimeoutSeconds * 1000
        : DEFAULT_RPC_TIMEOUT_MS,
    defaultQueueReceiveTimeoutMs:
      options.defaultQueueReceiveTimeoutSeconds != null
        ? options.defaultQueueReceiveTimeoutSeconds * 1000
        : DEFAULT_QUEUE_RECEIVE_TIMEOUT_MS,
    defaultQueuePollTimeoutMs:
      options.defaultQueuePollTimeoutSeconds != null
        ? options.defaultQueuePollTimeoutSeconds * 1000
        : DEFAULT_QUEUE_POLL_TIMEOUT_MS,
  };
}

function resolveTlsDefault(options: ClientOptions): boolean | TlsOptions {
  if (options.tls !== undefined) return options.tls;
  return isLocalhost(options.address) ? false : true;
}

function isLocalhost(address: string): boolean {
  let host: string;
  if (address.startsWith('[')) {
    const closingBracket = address.indexOf(']');
    host = closingBracket > 0 ? address.slice(0, closingBracket + 1) : address;
  } else {
    const lastColon = address.lastIndexOf(':');
    host = lastColon > 0 ? address.slice(0, lastColon) : address;
  }
  host = host.toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
}
