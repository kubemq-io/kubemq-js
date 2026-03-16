/** @internal */

import { ConfigurationError, ErrorCode } from '../errors.js';
import type {
  ClientOptions,
  RetryPolicy,
  ReconnectionPolicy,
  KeepaliveOptions,
} from '../options.js';

export function validateClientOptions(opts: ClientOptions): void {
  if (!opts.address || opts.address.trim() === '') {
    throw new ConfigurationError({
      code: ErrorCode.ConfigurationError,
      message: 'Client address is required and cannot be empty',
      operation: 'KubeMQClient.create',
      isRetryable: false,
      suggestion: "Provide a valid address like 'localhost:50000'",
    });
  }

  if (!isValidAddress(opts.address)) {
    throw new ConfigurationError({
      code: ErrorCode.ConfigurationError,
      message: `Invalid address format: "${opts.address}". Expected "host:port" format`,
      operation: 'KubeMQClient.create',
      isRetryable: false,
      suggestion: "Use format 'hostname:port' (e.g., 'localhost:50000')",
    });
  }

  if (opts.connectionTimeoutMs !== undefined && opts.connectionTimeoutMs <= 0) {
    throw new ConfigurationError({
      code: ErrorCode.ConfigurationError,
      message: `connectionTimeoutMs must be positive, got ${String(opts.connectionTimeoutMs)}`,
      operation: 'KubeMQClient.create',
      isRetryable: false,
    });
  }

  if (opts.maxReceiveMessageSize !== undefined && opts.maxReceiveMessageSize <= 0) {
    throw new ConfigurationError({
      code: ErrorCode.ConfigurationError,
      message: `maxReceiveMessageSize must be positive, got ${String(opts.maxReceiveMessageSize)}`,
      operation: 'KubeMQClient.create',
      isRetryable: false,
    });
  }

  if (opts.maxSendMessageSize !== undefined && opts.maxSendMessageSize <= 0) {
    throw new ConfigurationError({
      code: ErrorCode.ConfigurationError,
      message: `maxSendMessageSize must be positive, got ${String(opts.maxSendMessageSize)}`,
      operation: 'KubeMQClient.create',
      isRetryable: false,
    });
  }

  if (opts.reconnectBufferSize !== undefined && opts.reconnectBufferSize < 0) {
    throw new ConfigurationError({
      code: ErrorCode.ConfigurationError,
      message: `reconnectBufferSize must be non-negative, got ${String(opts.reconnectBufferSize)}`,
      operation: 'KubeMQClient.create',
      isRetryable: false,
    });
  }

  if (opts.clientId?.trim().length === 0) {
    throw new ConfigurationError({
      code: ErrorCode.ConfigurationError,
      message: 'clientId must not be empty when provided',
      operation: 'KubeMQClient.create',
      isRetryable: false,
      suggestion: 'Omit clientId to auto-generate one, or provide a non-empty string',
    });
  }

  validateTlsOptions(opts);
  validateRetryPolicy(opts.retry);
  validateReconnectionPolicy(opts.reconnect);
  validateKeepaliveOptions(opts.keepalive);
}

function isValidAddress(address: string): boolean {
  const parts = address.split(':');
  if (parts.length < 2) return false;
  const portStr = parts[parts.length - 1];
  if (portStr === undefined) return false;
  const port = Number(portStr);
  if (isNaN(port) || port <= 0 || port > 65535) return false;
  const host = parts.slice(0, -1).join(':');
  return host.length > 0;
}

function validateTlsOptions(opts: ClientOptions): void {
  if (typeof opts.tls === 'object') {
    const tls = opts.tls;
    if (tls.clientCert && !tls.clientKey) {
      throw new ConfigurationError({
        code: ErrorCode.ConfigurationError,
        message: 'TLS clientKey is required when clientCert is provided',
        operation: 'KubeMQClient.create',
        isRetryable: false,
        suggestion: 'Provide both clientCert and clientKey for mutual TLS',
      });
    }
    if (tls.clientKey && !tls.clientCert) {
      throw new ConfigurationError({
        code: ErrorCode.ConfigurationError,
        message: 'TLS clientCert is required when clientKey is provided',
        operation: 'KubeMQClient.create',
        isRetryable: false,
        suggestion: 'Provide both clientCert and clientKey for mutual TLS',
      });
    }
  }
}

function validateRetryPolicy(retry: RetryPolicy | undefined): void {
  if (!retry) return;
  if (retry.maxRetries < 0) {
    throw new ConfigurationError({
      code: ErrorCode.ConfigurationError,
      message: `retry.maxRetries must be >= 0, got ${String(retry.maxRetries)}`,
      operation: 'KubeMQClient.create',
      isRetryable: false,
    });
  }
  if (retry.initialBackoffMs <= 0) {
    throw new ConfigurationError({
      code: ErrorCode.ConfigurationError,
      message: `retry.initialBackoffMs must be positive, got ${String(retry.initialBackoffMs)}`,
      operation: 'KubeMQClient.create',
      isRetryable: false,
    });
  }
  if (retry.maxBackoffMs <= 0) {
    throw new ConfigurationError({
      code: ErrorCode.ConfigurationError,
      message: `retry.maxBackoffMs must be positive, got ${String(retry.maxBackoffMs)}`,
      operation: 'KubeMQClient.create',
      isRetryable: false,
    });
  }
}

function validateReconnectionPolicy(reconnect: ReconnectionPolicy | undefined): void {
  if (!reconnect) return;
  if (reconnect.initialDelayMs <= 0) {
    throw new ConfigurationError({
      code: ErrorCode.ConfigurationError,
      message: `reconnect.initialDelayMs must be positive, got ${String(reconnect.initialDelayMs)}`,
      operation: 'KubeMQClient.create',
      isRetryable: false,
    });
  }
  if (reconnect.maxDelayMs <= 0) {
    throw new ConfigurationError({
      code: ErrorCode.ConfigurationError,
      message: `reconnect.maxDelayMs must be positive, got ${String(reconnect.maxDelayMs)}`,
      operation: 'KubeMQClient.create',
      isRetryable: false,
    });
  }
}

function validateKeepaliveOptions(keepalive: KeepaliveOptions | undefined): void {
  if (!keepalive) return;
  if (keepalive.timeMs <= 0) {
    throw new ConfigurationError({
      code: ErrorCode.ConfigurationError,
      message: `keepalive.timeMs must be positive, got ${String(keepalive.timeMs)}`,
      operation: 'KubeMQClient.create',
      isRetryable: false,
    });
  }
  if (keepalive.timeoutMs <= 0) {
    throw new ConfigurationError({
      code: ErrorCode.ConfigurationError,
      message: `keepalive.timeoutMs must be positive, got ${String(keepalive.timeoutMs)}`,
      operation: 'KubeMQClient.create',
      isRetryable: false,
    });
  }
}
