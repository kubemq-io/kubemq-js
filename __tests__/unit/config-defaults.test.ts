import { describe, it, expect } from 'vitest';
import { applyDefaults } from '../../src/internal/config-defaults.js';
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
} from '../../src/options.js';

describe('applyDefaults', () => {
  it('generates clientId when not provided', () => {
    const resolved = applyDefaults({ address: 'localhost:50000' });
    expect(resolved.clientId).toBeDefined();
    expect(typeof resolved.clientId).toBe('string');
    expect(resolved.clientId.length).toBeGreaterThan(0);
  });

  it('uses provided clientId when given', () => {
    const resolved = applyDefaults({
      address: 'localhost:50000',
      clientId: 'my-client',
    });
    expect(resolved.clientId).toBe('my-client');
  });

  it('defaults tls to false for localhost', () => {
    const resolved = applyDefaults({ address: 'localhost:50000' });
    expect(resolved.tls).toBe(false);
  });

  it('defaults tls to true for remote addresses', () => {
    const resolved = applyDefaults({ address: 'kubemq.example.com:50000' });
    expect(resolved.tls).toBe(true);
  });

  it('uses provided tls value', () => {
    const resolved = applyDefaults({
      address: 'localhost:50000',
      tls: true,
    });
    expect(resolved.tls).toBe(true);
  });

  it('defaults keepalive options', () => {
    const resolved = applyDefaults({ address: 'localhost:50000' });
    expect(resolved.keepalive.timeMs).toBe(10_000);
    expect(resolved.keepalive.timeoutMs).toBe(5_000);
    expect(resolved.keepalive.permitWithoutCalls).toBe(true);
  });

  it('defaults retry policy', () => {
    const resolved = applyDefaults({ address: 'localhost:50000' });
    expect(resolved.retry.maxRetries).toBe(3);
    expect(resolved.retry.initialBackoffMs).toBe(500);
    expect(resolved.retry.maxBackoffMs).toBe(30_000);
    expect(resolved.retry.multiplier).toBe(2.0);
    expect(resolved.retry.jitter).toBe('full');
  });

  it('defaults reconnect policy', () => {
    const resolved = applyDefaults({ address: 'localhost:50000' });
    expect(resolved.reconnect.maxAttempts).toBe(-1);
    expect(resolved.reconnect.initialDelayMs).toBe(500);
    expect(resolved.reconnect.maxDelayMs).toBe(30_000);
    expect(resolved.reconnect.multiplier).toBe(2.0);
    expect(resolved.reconnect.jitter).toBe('full');
  });

  it('defaults numeric options', () => {
    const resolved = applyDefaults({ address: 'localhost:50000' });
    expect(resolved.connectionTimeoutMs).toBe(DEFAULT_CONNECTION_TIMEOUT_MS);
    expect(resolved.maxReceiveMessageSize).toBe(DEFAULT_MAX_MESSAGE_SIZE);
    expect(resolved.maxSendMessageSize).toBe(DEFAULT_MAX_MESSAGE_SIZE);
    expect(resolved.reconnectBufferSize).toBe(DEFAULT_RECONNECT_BUFFER_SIZE);
    expect(resolved.maxConcurrentRetries).toBe(DEFAULT_MAX_CONCURRENT_RETRIES);
    expect(resolved.defaultSendTimeoutMs).toBe(DEFAULT_SEND_TIMEOUT_MS);
    expect(resolved.defaultSubscribeTimeoutMs).toBe(DEFAULT_SUBSCRIBE_TIMEOUT_MS);
    expect(resolved.defaultRpcTimeoutMs).toBe(DEFAULT_RPC_TIMEOUT_MS);
    expect(resolved.defaultQueueReceiveTimeoutMs).toBe(DEFAULT_QUEUE_RECEIVE_TIMEOUT_MS);
    expect(resolved.defaultQueuePollTimeoutMs).toBe(DEFAULT_QUEUE_POLL_TIMEOUT_MS);
  });

  it('defaults waitForReady to true', () => {
    const resolved = applyDefaults({ address: 'localhost:50000' });
    expect(resolved.waitForReady).toBe(true);
  });

  it('defaults reconnectBufferMode to error', () => {
    const resolved = applyDefaults({ address: 'localhost:50000' });
    expect(resolved.reconnectBufferMode).toBe('error');
  });

  it('handles IPv6 localhost [::1]:50000', () => {
    const resolved = applyDefaults({ address: '[::1]:50000' });
    expect(resolved.tls).toBe(false);
  });

  it('handles 127.0.0.1:50000 as localhost', () => {
    const resolved = applyDefaults({ address: '127.0.0.1:50000' });
    expect(resolved.tls).toBe(false);
  });

  it('overrides keepalive with user values', () => {
    const resolved = applyDefaults({
      address: 'localhost:50000',
      keepalive: { timeMs: 20_000, timeoutMs: 10_000, permitWithoutCalls: false },
    });
    expect(resolved.keepalive.timeMs).toBe(20_000);
    expect(resolved.keepalive.timeoutMs).toBe(10_000);
    expect(resolved.keepalive.permitWithoutCalls).toBe(false);
  });

  it('overrides retry policy with user values', () => {
    const resolved = applyDefaults({
      address: 'localhost:50000',
      retry: {
        maxRetries: 5,
        initialBackoffMs: 1000,
        maxBackoffMs: 60_000,
        multiplier: 3.0,
        jitter: 'none',
      },
    });
    expect(resolved.retry.maxRetries).toBe(5);
    expect(resolved.retry.initialBackoffMs).toBe(1000);
    expect(resolved.retry.maxBackoffMs).toBe(60_000);
    expect(resolved.retry.multiplier).toBe(3.0);
    expect(resolved.retry.jitter).toBe('none');
  });
});
