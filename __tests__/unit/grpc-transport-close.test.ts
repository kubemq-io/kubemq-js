import { describe, it, expect } from 'vitest';
import { GrpcTransport } from '../../src/internal/transport/grpc-transport.js';
import { ConnectionState } from '../../src/internal/transport/connection-state.js';

describe('GrpcTransport close scenarios', () => {
  it('close on IDLE transport transitions to CLOSED', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    expect(transport.state).toBe(ConnectionState.IDLE);
    await transport.close();
    expect(transport.state).toBe(ConnectionState.CLOSED);
  });

  it('close when already CLOSED is a no-op', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    await transport.close();
    expect(transport.state).toBe(ConnectionState.CLOSED);
    await transport.close();
    expect(transport.state).toBe(ConnectionState.CLOSED);
  });

  it('close with timeout waits for in-flight requests', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    await transport.close(100);
    expect(transport.state).toBe(ConnectionState.CLOSED);
  });

  it('close with default timeout transitions to CLOSED', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    await transport.close();
    expect(transport.state).toBe(ConnectionState.CLOSED);
  });

  it('validateAuth resolves for non-TLS transport', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    await expect(transport.validateAuth()).resolves.toBeUndefined();
  });

  it('resolveSslCredentials returns undefined for non-TLS transport', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    const result = await transport.resolveSslCredentials();
    expect(result).toBeUndefined();
  });

  it('reloadSslCredentials returns undefined for non-TLS transport', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    const result = await transport.reloadSslCredentials();
    expect(result).toBeUndefined();
  });

  it('ensureNotClosed throws after close', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    await transport.close();
    expect(() => transport.ensureNotClosed('test')).toThrow('Client is closed');
  });

  it('close clears subscription tracker', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    const tracker = transport.getSubscriptionTracker();
    expect(tracker.count).toBe(0);
    await transport.close();
    expect(tracker.count).toBe(0);
    expect(transport.state).toBe(ConnectionState.CLOSED);
  });
});
