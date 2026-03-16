import { describe, it, expect } from 'vitest';
import { MockTransport } from '../fixtures/mock-transport.js';
import { ConnectionState } from '../../src/internal/transport/connection-state.js';

describe('MockTransport', () => {
  it('starts in IDLE state', () => {
    const transport = new MockTransport();
    expect(transport.state).toBe(ConnectionState.IDLE);
  });

  it('connect transitions to READY', async () => {
    const transport = new MockTransport();
    await transport.connect();
    expect(transport.state).toBe(ConnectionState.READY);
  });

  it('close transitions to CLOSED', async () => {
    const transport = new MockTransport();
    await transport.connect();
    await transport.close();
    expect(transport.state).toBe(ConnectionState.CLOSED);
  });

  it('connect with fail behavior throws', async () => {
    const transport = new MockTransport();
    transport.setConnectBehavior('fail', new Error('connection refused'));
    await expect(transport.connect()).rejects.toThrow('connection refused');
  });

  it('records unary calls', async () => {
    const transport = new MockTransport();
    transport.onUnaryCall('SendRequest', () => ({ ok: true }));
    await transport.connect();
    await transport.unaryCall('SendRequest', { data: 'test' });
    expect(transport.callsTo('SendRequest')).toHaveLength(1);
    expect(transport.callsTo('SendRequest')[0]!.request).toEqual({ data: 'test' });
  });

  it('unary call without handler throws', async () => {
    const transport = new MockTransport();
    await expect(transport.unaryCall('Unknown', {})).rejects.toThrow('no handler registered');
  });

  it('serverStream handle simulates data', () => {
    const transport = new MockTransport();
    const handle = transport.serverStream('Subscribe', {});
    const received: unknown[] = [];
    handle.onData((msg) => received.push(msg));
    handle.simulateData({ id: 'msg-1' });
    handle.simulateData({ id: 'msg-2' });
    expect(received).toHaveLength(2);
  });

  it('serverStream handle simulates error', () => {
    const transport = new MockTransport();
    const handle = transport.serverStream('Subscribe', {});
    const errors: Error[] = [];
    handle.onError((err) => errors.push(err));
    handle.simulateError(new Error('stream error'));
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toBe('stream error');
  });

  it('duplexStream handle records writes', () => {
    const transport = new MockTransport();
    const handle = transport.duplexStream('Stream');
    handle.write({ data: 'hello' });
    expect(handle.written).toHaveLength(1);
    expect(handle.written[0]).toEqual({ data: 'hello' });
  });

  it('duplexStream cancel sets cancelled flag', () => {
    const transport = new MockTransport();
    const handle = transport.duplexStream('Stream');
    expect(handle.cancelled).toBe(false);
    handle.cancel();
    expect(handle.cancelled).toBe(true);
  });

  it('simulateDisconnect/simulateReconnect transitions', () => {
    const transport = new MockTransport();
    const states: ConnectionState[] = [];
    transport.on('stateChange', (s) => states.push(s));
    transport.simulateDisconnect();
    transport.simulateReconnect();
    expect(states).toEqual([ConnectionState.RECONNECTING, ConnectionState.READY]);
  });

  it('off removes listener', () => {
    const transport = new MockTransport();
    const states: ConnectionState[] = [];
    const handler = (s: ConnectionState) => states.push(s);
    transport.on('stateChange', handler);
    transport.simulateDisconnect();
    transport.off('stateChange', handler);
    transport.simulateReconnect();
    expect(states).toEqual([ConnectionState.RECONNECTING]);
  });

  it('reset clears all state', async () => {
    const transport = new MockTransport();
    transport.onUnaryCall('Ping', () => ({}));
    await transport.connect();
    await transport.unaryCall('Ping', {});
    transport.reset();
    expect(transport.state).toBe(ConnectionState.IDLE);
    expect(transport.calls).toHaveLength(0);
  });

  it('getMetadata returns empty object', () => {
    const transport = new MockTransport();
    expect(transport.getMetadata()).toEqual({});
  });

  it('setMetadata is a no-op without error', () => {
    const transport = new MockTransport();
    expect(() => transport.setMetadata('key', 'value')).not.toThrow();
  });
});
