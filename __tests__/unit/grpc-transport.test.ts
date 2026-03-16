import { describe, it, expect } from 'vitest';
import { buildChannelOptions, GrpcTransport } from '../../src/internal/transport/grpc-transport.js';
import { ConnectionState } from '../../src/internal/transport/connection-state.js';
import { ConnectionStateMachine } from '../../src/internal/transport/connection-state-machine.js';
import { SubscriptionTracker } from '../../src/internal/transport/subscription-tracker.js';
import { InFlightTracker } from '../../src/internal/transport/in-flight-tracker.js';
import { MessageBuffer } from '../../src/internal/transport/message-buffer.js';
import { ClientClosedError } from '../../src/errors.js';
import { TokenCache } from '../../src/auth/token-cache.js';
import { noopLogger } from '../../src/logger.js';

describe('buildChannelOptions', () => {
  it('returns defaults for minimal options', () => {
    const opts = buildChannelOptions({ address: 'localhost:50000' });
    expect(opts['grpc.max_receive_message_length']).toBe(104_857_600);
    expect(opts['grpc.max_send_message_length']).toBe(104_857_600);
    expect(opts['grpc.keepalive_time_ms']).toBe(10_000);
    expect(opts['grpc.keepalive_timeout_ms']).toBe(5_000);
    expect(opts['grpc.keepalive_permit_without_calls']).toBe(1);
    expect(opts['grpc.dns_min_time_between_resolutions_ms']).toBe(1_000);
  });

  it('uses custom keepalive options', () => {
    const opts = buildChannelOptions({
      address: 'localhost:50000',
      keepalive: { timeMs: 20_000, timeoutMs: 10_000, permitWithoutCalls: false },
    });
    expect(opts['grpc.keepalive_time_ms']).toBe(20_000);
    expect(opts['grpc.keepalive_timeout_ms']).toBe(10_000);
    expect(opts['grpc.keepalive_permit_without_calls']).toBe(0);
  });

  it('uses custom reconnect policy', () => {
    const opts = buildChannelOptions({
      address: 'localhost:50000',
      reconnect: {
        maxAttempts: 5,
        initialDelayMs: 1000,
        maxDelayMs: 60_000,
        multiplier: 3,
        jitter: 'none',
      },
    });
    expect(opts['grpc.initial_reconnect_backoff_ms']).toBe(1000);
    expect(opts['grpc.max_reconnect_backoff_ms']).toBe(60_000);
    expect(opts['grpc.min_reconnect_backoff_ms']).toBe(1000);
  });

  it('sets ssl_target_name_override when tls.serverNameOverride is set', () => {
    const opts = buildChannelOptions({
      address: 'remote:50000',
      tls: { serverNameOverride: 'custom.host' },
    });
    expect(opts['grpc.ssl_target_name_override']).toBe('custom.host');
  });

  it('does not set ssl_target_name_override when tls is boolean', () => {
    const opts = buildChannelOptions({
      address: 'remote:50000',
      tls: true,
    });
    expect(opts['grpc.ssl_target_name_override']).toBeUndefined();
  });

  it('does not set ssl_target_name_override when tls is undefined', () => {
    const opts = buildChannelOptions({ address: 'remote:50000' });
    expect(opts['grpc.ssl_target_name_override']).toBeUndefined();
  });

  it('does not set ssl_target_name_override when serverNameOverride is absent', () => {
    const opts = buildChannelOptions({
      address: 'remote:50000',
      tls: { enabled: true },
    });
    expect(opts['grpc.ssl_target_name_override']).toBeUndefined();
  });

  it('uses custom maxReceiveMessageSize', () => {
    const opts = buildChannelOptions({
      address: 'localhost:50000',
      maxReceiveMessageSize: 50_000_000,
    });
    expect(opts['grpc.max_receive_message_length']).toBe(50_000_000);
  });

  it('uses custom maxSendMessageSize', () => {
    const opts = buildChannelOptions({
      address: 'localhost:50000',
      maxSendMessageSize: 25_000_000,
    });
    expect(opts['grpc.max_send_message_length']).toBe(25_000_000);
  });

  it('returns default keepalive when not specified', () => {
    const opts = buildChannelOptions({ address: 'localhost:50000' });
    expect(opts['grpc.keepalive_time_ms']).toBe(10_000);
    expect(opts['grpc.keepalive_timeout_ms']).toBe(5_000);
    expect(opts['grpc.keepalive_permit_without_calls']).toBe(1);
  });

  it('returns default reconnect when not specified', () => {
    const opts = buildChannelOptions({ address: 'localhost:50000' });
    expect(opts['grpc.initial_reconnect_backoff_ms']).toBe(500);
    expect(opts['grpc.max_reconnect_backoff_ms']).toBe(30_000);
    expect(opts['grpc.min_reconnect_backoff_ms']).toBe(500);
  });
});

describe('GrpcTransport', () => {
  it('constructor creates transport in IDLE state', () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    expect(transport.state).toBe(ConnectionState.IDLE);
  });

  it('getStateMachine returns ConnectionStateMachine', () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    expect(transport.getStateMachine()).toBeInstanceOf(ConnectionStateMachine);
  });

  it('getSubscriptionTracker returns SubscriptionTracker', () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    expect(transport.getSubscriptionTracker()).toBeInstanceOf(SubscriptionTracker);
  });

  it('getInFlightTracker returns InFlightTracker', () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    expect(transport.getInFlightTracker()).toBeInstanceOf(InFlightTracker);
  });

  it('getMessageBuffer returns MessageBuffer', () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    expect(transport.getMessageBuffer()).toBeInstanceOf(MessageBuffer);
  });

  it('getChannelOptions returns GrpcChannelOptions', () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    const opts = transport.getChannelOptions();
    expect(opts['grpc.max_receive_message_length']).toBe(104_857_600);
  });

  it('setMetadata/getMetadata works', () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    transport.setMetadata('x-client-id', 'test-123');
    transport.setMetadata('x-channel', 'orders');
    const meta = transport.getMetadata();
    expect(meta['x-client-id']).toBe('test-123');
    expect(meta['x-channel']).toBe('orders');
  });

  it('getMetadata returns empty object initially', () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    expect(transport.getMetadata()).toEqual({});
  });

  it('ensureNotClosed does not throw when transport is open', () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    expect(() => transport.ensureNotClosed('test')).not.toThrow();
  });

  it('ensureNotClosed throws ClientClosedError when closed', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    await transport.close();
    expect(() => transport.ensureNotClosed('sendEvent')).toThrow(ClientClosedError);
  });

  it('getTokenCache returns undefined when no credentials', () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    expect(transport.getTokenCache()).toBeUndefined();
  });

  it('getCredentialProvider returns undefined when no credentials', () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    expect(transport.getCredentialProvider()).toBeUndefined();
  });

  it('getResolvedTls returns normalized TLS options', () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    const tls = transport.getResolvedTls();
    expect(tls).toHaveProperty('enabled');
    expect(typeof tls.enabled).toBe('boolean');
  });

  it('getResolvedTls returns enabled=false for localhost', () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    expect(transport.getResolvedTls().enabled).toBe(false);
  });

  it('getResolvedTls returns enabled=true for remote address', () => {
    const transport = new GrpcTransport({ address: 'kubemq.example.com:50000' });
    expect(transport.getResolvedTls().enabled).toBe(true);
  });

  it('close on already-closed transport is no-op', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    await transport.close();
    await transport.close();
    expect(transport.state).toBe(ConnectionState.CLOSED);
  });

  it('getReconnectionManager returns a manager', () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    expect(transport.getReconnectionManager()).toBeDefined();
  });

  it('creates tokenCache when credentials are provided (insecure mode)', () => {
    const transport = new GrpcTransport({
      address: 'localhost:50000',
      tls: false,
      credentials: 'my-secret-token',
    });
    expect(transport.getTokenCache()).toBeInstanceOf(TokenCache);
    expect(transport.getResolvedTls().enabled).toBe(false);
  });

  it('creates tokenCache when credentials are provided (TLS mode)', () => {
    const transport = new GrpcTransport({
      address: 'remote.host:50000',
      credentials: 'my-secret-token',
    });
    expect(transport.getTokenCache()).toBeInstanceOf(TokenCache);
    expect(transport.getResolvedTls().enabled).toBe(true);
  });
});

describe('TokenCache.lastKnownToken', () => {
  it('returns undefined when no token has been fetched', () => {
    const cache = new TokenCache({ getToken: async () => ({ token: 'tok' }) }, noopLogger);
    expect(cache.lastKnownToken).toBeUndefined();
  });

  it('returns cached token after getToken()', async () => {
    const cache = new TokenCache({ getToken: async () => ({ token: 'my-token' }) }, noopLogger);
    await cache.getToken();
    expect(cache.lastKnownToken).toBe('my-token');
  });

  it('returns undefined after invalidate()', async () => {
    const cache = new TokenCache({ getToken: async () => ({ token: 'my-token' }) }, noopLogger);
    await cache.getToken();
    cache.invalidate();
    expect(cache.lastKnownToken).toBeUndefined();
  });

  it('returns undefined after dispose()', async () => {
    const cache = new TokenCache({ getToken: async () => ({ token: 'my-token' }) }, noopLogger);
    await cache.getToken();
    cache.dispose();
    expect(cache.lastKnownToken).toBeUndefined();
  });
});
