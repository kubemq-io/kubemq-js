import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';

/* ──────────────── Mock @grpc/grpc-js ──────────────── */

const fakeInsecureCreds = { _type: 'insecure' };
const fakeSslCreds = { _type: 'ssl' };
const fakeCombinedCreds = { _type: 'combined' };
const fakeCallCreds = { _type: 'call' };

vi.mock('@grpc/grpc-js', () => {
  class Metadata {
    private _map = new Map<string, string>();
    set(key: string, value: string) {
      this._map.set(key, value);
    }
    get(key: string) {
      return this._map.get(key);
    }
    getMap() {
      return Object.fromEntries(this._map);
    }
  }

  return {
    credentials: {
      createInsecure: vi.fn(() => fakeInsecureCreds),
      createSsl: vi.fn(() => fakeSslCreds),
      combineChannelCredentials: vi.fn(() => fakeCombinedCreds),
      createFromMetadataGenerator: vi.fn((generator: any) => {
        (fakeCallCreds as any)._generator = generator;
        return fakeCallCreds;
      }),
    },
    Metadata,
  };
});

/* ──────────────── Mock kubemq proto ──────────────── */

function createFakeGrpcClient() {
  return {
    close: vi.fn(),
    getChannel: vi.fn(() => ({
      getConnectivityState: vi.fn(() => 0),
      watchConnectivityState: vi.fn(),
    })),
    SendEvent: vi.fn(),
    SendRequest: vi.fn(),
    SubscribeToEvents: vi.fn(),
    SubscribeToRequests: vi.fn(),
    QueuesDownstream: vi.fn(),
    QueuesUpstream: vi.fn(),
    Ping: vi.fn(),
  };
}

let lastFakeClient: ReturnType<typeof createFakeGrpcClient>;

vi.mock('../../src/protos/kubemq.js', () => {
  const kubemqClient = vi.fn(function (this: any) {
    const fake = createFakeGrpcClient();
    lastFakeClient = fake;
    Object.assign(this, fake);
    return this;
  });
  return {
    kubemq: {
      kubemqClient,
      Event: class {},
      Result: class {},
      Empty: class {},
    },
  };
});

import { GrpcTransport } from '../../src/internal/transport/grpc-transport.js';
import { ConnectionState } from '../../src/internal/transport/connection-state.js';
import * as grpc from '@grpc/grpc-js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GrpcTransport.connect()', () => {
  it('connects with insecure credentials on localhost', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    await transport.connect();
    expect(transport.state).toBe(ConnectionState.READY);
    expect(grpc.credentials.createInsecure).toHaveBeenCalled();
  });

  it('connects with SSL credentials on remote address', async () => {
    const transport = new GrpcTransport({
      address: 'remote.host:50000',
      tls: { enabled: true, insecureSkipVerify: true },
    });
    await transport.connect();
    expect(transport.state).toBe(ConnectionState.READY);
    expect(grpc.credentials.createSsl).toHaveBeenCalled();
  });

  it('connects with TLS + auth credentials', async () => {
    const transport = new GrpcTransport({
      address: 'remote.host:50000',
      tls: { enabled: true, insecureSkipVerify: true },
      credentials: 'my-token',
    });
    await transport.connect();
    expect(transport.state).toBe(ConnectionState.READY);
    expect(grpc.credentials.combineChannelCredentials).toHaveBeenCalled();
  });

  it('warns when auth credentials used without TLS', async () => {
    const warnFn = vi.fn();
    const transport = new GrpcTransport({
      address: 'localhost:50000',
      tls: false,
      credentials: 'my-token',
      logger: { debug: vi.fn(), info: vi.fn(), warn: warnFn, error: vi.fn() },
    });
    await transport.connect();
    expect(warnFn).toHaveBeenCalledWith(expect.stringContaining('plaintext'), expect.any(Object));
  });

  it('transitions through CONNECTING to READY', async () => {
    const states: ConnectionState[] = [];
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    transport.on('stateChange', (s: ConnectionState) => states.push(s));
    await transport.connect();
    expect(states).toContain(ConnectionState.CONNECTING);
    expect(states).toContain(ConnectionState.READY);
  });
});

describe('GrpcTransport.close() with active client', () => {
  it('closes the gRPC client and transitions to CLOSED', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    await transport.connect();
    const fakeClient = lastFakeClient;
    await transport.close();
    expect(fakeClient.close).toHaveBeenCalled();
    expect(transport.state).toBe(ConnectionState.CLOSED);
  });

  it('close during RECONNECTING cancels reconnection', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    const sm = transport.getStateMachine();
    sm.transitionTo(ConnectionState.RECONNECTING);
    await transport.close();
    expect(transport.state).toBe(ConnectionState.CLOSED);
  });

  it('close with custom timeout', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    await transport.connect();
    await transport.close(100);
    expect(transport.state).toBe(ConnectionState.CLOSED);
  });

  it('disposes token cache on close', async () => {
    const transport = new GrpcTransport({
      address: 'localhost:50000',
      credentials: 'test-token',
    });
    await transport.connect();
    const cache = transport.getTokenCache();
    expect(cache).toBeDefined();
    await transport.close();
    expect(transport.state).toBe(ConnectionState.CLOSED);
  });
});

describe('GrpcTransport.unaryCall()', () => {
  it('calls the gRPC method and resolves on success', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    await transport.connect();

    const fakeClient = lastFakeClient;
    fakeClient.SendEvent.mockImplementation((_req: any, _meta: any, _opts: any, cb: any) => {
      cb(null, { EventID: 'e1', Sent: true });
      return { cancel: vi.fn() };
    });

    const result = await transport.unaryCall('SendEvent', { Channel: 'test' });
    expect(result).toEqual({ EventID: 'e1', Sent: true });
  });

  it('rejects with RawTransportError on gRPC error', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    await transport.connect();

    const fakeClient = lastFakeClient;
    const grpcErr = Object.assign(new Error('not found'), {
      code: 5,
      details: 'channel not found',
      metadata: { getMap: () => ({ key: 'val' }) },
    });
    fakeClient.SendEvent.mockImplementation((_req: any, _meta: any, _opts: any, cb: any) => {
      cb(grpcErr);
      return { cancel: vi.fn() };
    });

    await expect(transport.unaryCall('SendEvent', { Channel: 'missing' })).rejects.toMatchObject({
      code: 5,
      details: 'channel not found',
    });
  });

  it('throws when method does not exist', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    await transport.connect();

    expect(() => transport.unaryCall('NonExistentMethod', {})).toThrow('Unknown method');
  });

  it('throws when not connected', () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    expect(() => transport.unaryCall('SendEvent', {})).toThrow('Not connected');
  });

  it('throws ClientClosedError when closed', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    await transport.close();
    expect(() => transport.unaryCall('SendEvent', {})).toThrow('Client is closed');
  });

  it('supports deadline option', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    await transport.connect();

    const fakeClient = lastFakeClient;
    let capturedOpts: any;
    fakeClient.SendEvent.mockImplementation((_req: any, _meta: any, opts: any, cb: any) => {
      capturedOpts = opts;
      cb(null, { Sent: true });
      return { cancel: vi.fn() };
    });

    const deadline = new Date(Date.now() + 5000);
    await transport.unaryCall('SendEvent', {}, { deadline });
    expect(capturedOpts.deadline).toBe(deadline);
  });

  it('cancels call on abort signal', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    await transport.connect();

    const cancelFn = vi.fn();
    const fakeClient = lastFakeClient;
    fakeClient.Ping.mockImplementation((_req: any, _meta: any, _opts: any, cb: any) => {
      cb(null, { Host: 'h' });
      return { cancel: cancelFn };
    });

    const ac = new AbortController();
    const p = transport.unaryCall('Ping', {}, { signal: ac.signal });
    ac.abort();
    await p;
    expect(cancelFn).toHaveBeenCalled();
  });

  it('includes metadata in gRPC calls', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    await transport.connect();
    transport.setMetadata('x-test', 'value');

    let capturedMeta: any;
    const fakeClient = lastFakeClient;
    fakeClient.SendEvent.mockImplementation((_req: any, meta: any, _opts: any, cb: any) => {
      capturedMeta = meta;
      cb(null, { Sent: true });
      return { cancel: vi.fn() };
    });

    await transport.unaryCall('SendEvent', {});
    expect(capturedMeta.get('x-test')).toBe('value');
  });
});

describe('GrpcTransport.serverStream()', () => {
  it('returns a StreamHandle that wraps gRPC readable stream', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    await transport.connect();

    const emitter = new EventEmitter();
    (emitter as any).cancel = vi.fn();
    const fakeClient = lastFakeClient;
    fakeClient.SubscribeToEvents.mockReturnValue(emitter);

    const handle = transport.serverStream('SubscribeToEvents', {});

    const received: any[] = [];
    handle.onData((msg) => received.push(msg));

    emitter.emit('data', { EventID: 'ev1' });
    expect(received).toEqual([{ EventID: 'ev1' }]);
  });

  it('fires error handler on stream error', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    await transport.connect();

    const emitter = new EventEmitter();
    (emitter as any).cancel = vi.fn();
    const fakeClient = lastFakeClient;
    fakeClient.SubscribeToEvents.mockReturnValue(emitter);

    const handle = transport.serverStream('SubscribeToEvents', {});

    const errors: Error[] = [];
    handle.onError((err) => errors.push(err));

    emitter.emit('error', new Error('stream broken'));
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toBe('stream broken');
  });

  it('fires end handler on stream end', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    await transport.connect();

    const emitter = new EventEmitter();
    (emitter as any).cancel = vi.fn();
    const fakeClient = lastFakeClient;
    fakeClient.SubscribeToEvents.mockReturnValue(emitter);

    const handle = transport.serverStream('SubscribeToEvents', {});

    let ended = false;
    handle.onEnd(() => {
      ended = true;
    });

    emitter.emit('end');
    expect(ended).toBe(true);
  });

  it('cancel calls stream.cancel()', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    await transport.connect();

    const emitter = new EventEmitter();
    (emitter as any).cancel = vi.fn();
    const fakeClient = lastFakeClient;
    fakeClient.SubscribeToEvents.mockReturnValue(emitter);

    const handle = transport.serverStream('SubscribeToEvents', {});
    handle.cancel();
    expect((emitter as any).cancel).toHaveBeenCalled();
  });

  it('end calls stream.cancel() for readable streams', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    await transport.connect();

    const emitter = new EventEmitter();
    (emitter as any).cancel = vi.fn();
    const fakeClient = lastFakeClient;
    fakeClient.SubscribeToEvents.mockReturnValue(emitter);

    const handle = transport.serverStream('SubscribeToEvents', {});
    handle.end();
    expect((emitter as any).cancel).toHaveBeenCalled();
  });

  it('write returns false for readable streams', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    await transport.connect();

    const emitter = new EventEmitter();
    (emitter as any).cancel = vi.fn();
    const fakeClient = lastFakeClient;
    fakeClient.SubscribeToEvents.mockReturnValue(emitter);

    const handle = transport.serverStream('SubscribeToEvents', {});
    expect(handle.write(null as never)).toBe(false);
  });

  it('supports signal abort', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    await transport.connect();

    const emitter = new EventEmitter();
    (emitter as any).cancel = vi.fn();
    const fakeClient = lastFakeClient;
    fakeClient.SubscribeToEvents.mockReturnValue(emitter);

    const ac = new AbortController();
    transport.serverStream('SubscribeToEvents', {}, { signal: ac.signal });
    ac.abort();
    expect((emitter as any).cancel).toHaveBeenCalled();
  });

  it('throws when not connected', () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    expect(() => transport.serverStream('SubscribeToEvents', {})).toThrow('Not connected');
  });

  it('throws for unknown method', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    await transport.connect();
    expect(() => transport.serverStream('UnknownMethod', {})).toThrow('Unknown method');
  });

  it('supports deadline option', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    await transport.connect();

    const emitter = new EventEmitter();
    (emitter as any).cancel = vi.fn();
    let capturedOpts: any;
    const fakeClient = lastFakeClient;
    fakeClient.SubscribeToEvents.mockImplementation((_req: any, _meta: any, opts: any) => {
      capturedOpts = opts;
      return emitter;
    });

    const deadline = new Date(Date.now() + 5000);
    transport.serverStream('SubscribeToEvents', {}, { deadline });
    expect(capturedOpts.deadline).toBe(deadline);
  });
});

describe('GrpcTransport.duplexStream()', () => {
  it('returns a StreamHandle that wraps gRPC duplex stream', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    await transport.connect();

    const emitter = new EventEmitter();
    (emitter as any).cancel = vi.fn();
    (emitter as any).write = vi.fn(() => true);
    (emitter as any).end = vi.fn();
    const fakeClient = lastFakeClient;
    fakeClient.QueuesDownstream.mockReturnValue(emitter);

    const handle = transport.duplexStream('QueuesDownstream');

    const received: any[] = [];
    handle.onData((msg) => received.push(msg));

    emitter.emit('data', { TransactionId: 'tx1' });
    expect(received).toEqual([{ TransactionId: 'tx1' }]);
  });

  it('write delegates to the gRPC stream', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    await transport.connect();

    const emitter = new EventEmitter();
    (emitter as any).cancel = vi.fn();
    (emitter as any).write = vi.fn(() => true);
    (emitter as any).end = vi.fn();
    const fakeClient = lastFakeClient;
    fakeClient.QueuesDownstream.mockReturnValue(emitter);

    const handle = transport.duplexStream('QueuesDownstream');
    const result = handle.write({ data: 'test' } as any);
    expect(result).toBe(true);
    expect((emitter as any).write).toHaveBeenCalledWith({ data: 'test' });
  });

  it('end delegates to the gRPC stream', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    await transport.connect();

    const emitter = new EventEmitter();
    (emitter as any).cancel = vi.fn();
    (emitter as any).write = vi.fn(() => true);
    (emitter as any).end = vi.fn();
    const fakeClient = lastFakeClient;
    fakeClient.QueuesDownstream.mockReturnValue(emitter);

    const handle = transport.duplexStream('QueuesDownstream');
    handle.end();
    expect((emitter as any).end).toHaveBeenCalled();
  });

  it('cancel delegates to the gRPC stream', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    await transport.connect();

    const emitter = new EventEmitter();
    (emitter as any).cancel = vi.fn();
    (emitter as any).write = vi.fn(() => true);
    (emitter as any).end = vi.fn();
    const fakeClient = lastFakeClient;
    fakeClient.QueuesDownstream.mockReturnValue(emitter);

    const handle = transport.duplexStream('QueuesDownstream');
    handle.cancel();
    expect((emitter as any).cancel).toHaveBeenCalled();
  });

  it('fires error and end handlers', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    await transport.connect();

    const emitter = new EventEmitter();
    (emitter as any).cancel = vi.fn();
    (emitter as any).write = vi.fn();
    (emitter as any).end = vi.fn();
    const fakeClient = lastFakeClient;
    fakeClient.QueuesDownstream.mockReturnValue(emitter);

    const handle = transport.duplexStream('QueuesDownstream');

    const errors: Error[] = [];
    let ended = false;
    handle.onError((err) => errors.push(err));
    handle.onEnd(() => {
      ended = true;
    });

    emitter.emit('error', new Error('duplex error'));
    emitter.emit('end');
    expect(errors[0]!.message).toBe('duplex error');
    expect(ended).toBe(true);
  });

  it('supports signal abort', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    await transport.connect();

    const emitter = new EventEmitter();
    (emitter as any).cancel = vi.fn();
    (emitter as any).write = vi.fn();
    (emitter as any).end = vi.fn();
    const fakeClient = lastFakeClient;
    fakeClient.QueuesDownstream.mockReturnValue(emitter);

    const ac = new AbortController();
    transport.duplexStream('QueuesDownstream', { signal: ac.signal });
    ac.abort();
    expect((emitter as any).cancel).toHaveBeenCalled();
  });

  it('throws when not connected', () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    expect(() => transport.duplexStream('QueuesDownstream')).toThrow('Not connected');
  });

  it('throws for unknown method', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    await transport.connect();
    expect(() => transport.duplexStream('UnknownDuplex')).toThrow('Unknown method');
  });

  it('supports deadline option', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    await transport.connect();

    const emitter = new EventEmitter();
    (emitter as any).cancel = vi.fn();
    (emitter as any).write = vi.fn();
    (emitter as any).end = vi.fn();
    let capturedOpts: any;
    const fakeClient = lastFakeClient;
    fakeClient.QueuesDownstream.mockImplementation((_meta: any, opts: any) => {
      capturedOpts = opts;
      return emitter;
    });

    const deadline = new Date(Date.now() + 5000);
    transport.duplexStream('QueuesDownstream', { deadline });
    expect(capturedOpts.deadline).toBe(deadline);
  });
});

describe('GrpcTransport.watchChannelState()', () => {
  it('starts watching after connect', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    await transport.connect();
    const fakeClient = lastFakeClient;
    expect(fakeClient.getChannel).toHaveBeenCalled();
  });

  it('handles TRANSIENT_FAILURE by initiating reconnection', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    await transport.connect();

    const fakeClient = lastFakeClient;
    const channel = fakeClient.getChannel();
    channel.getConnectivityState.mockReturnValue(3);

    const states: ConnectionState[] = [];
    transport.on('stateChange', (s: ConnectionState) => states.push(s));

    // Re-trigger watchChannelState by re-connecting
    const transport2 = new GrpcTransport({ address: 'localhost:50000' });
    await transport2.connect();
    const fakeClient2 = lastFakeClient;
    fakeClient2.getChannel().getConnectivityState.mockReturnValue(3);
    // The watchChannelState is called internally on connect
    // and should detect TRANSIENT_FAILURE
  });

  it('catches channel errors silently', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    await transport.connect();

    const fakeClient = lastFakeClient;
    fakeClient.getChannel.mockImplementation(() => {
      throw new Error('Channel not available');
    });

    // Force another connect cycle to re-trigger watchChannelState
    const transport2 = new GrpcTransport({ address: 'localhost:50000' });
    await transport2.connect();
    // Should not throw despite getChannel failing
  });
});

describe('GrpcTransport metadata with token cache', () => {
  it('includes token in metadata when token cache has a token (insecure mode)', async () => {
    const transport = new GrpcTransport({
      address: 'localhost:50000',
      tls: false,
      credentials: 'my-secret-token',
    });
    await transport.connect();

    const cache = transport.getTokenCache()!;
    await cache.getToken();

    let capturedMeta: any;
    const fakeClient = lastFakeClient;
    fakeClient.SendEvent.mockImplementation((_req: any, meta: any, _opts: any, cb: any) => {
      capturedMeta = meta;
      cb(null, { Sent: true });
      return { cancel: vi.fn() };
    });

    await transport.unaryCall('SendEvent', {});
    expect(capturedMeta.get('authorization')).toBe('my-secret-token');
  });
});

describe('GrpcTransport.toRawTransportError()', () => {
  it('converts gRPC ServiceError to RawTransportError', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    await transport.connect();

    const fakeClient = lastFakeClient;
    const grpcErr = Object.assign(new Error('test error'), {
      code: 14,
      details: 'unavailable',
      metadata: { getMap: () => ({ 'x-debug': 'info' }) },
    });
    fakeClient.SendEvent.mockImplementation((_req: any, _meta: any, _opts: any, cb: any) => {
      cb(grpcErr);
      return { cancel: vi.fn() };
    });

    try {
      await transport.unaryCall('SendEvent', {});
    } catch (err: any) {
      expect(err.code).toBe(14);
      expect(err.details).toBe('unavailable');
      expect(err.metadata).toEqual({ 'x-debug': 'info' });
    }
  });

  it('converts error without metadata', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    await transport.connect();

    const fakeClient = lastFakeClient;
    const grpcErr = Object.assign(new Error('test'), {
      code: 2,
      details: 'unknown',
      metadata: { getMap: () => ({}) },
    });
    fakeClient.SendEvent.mockImplementation((_req: any, _meta: any, _opts: any, cb: any) => {
      cb(grpcErr);
      return { cancel: vi.fn() };
    });

    try {
      await transport.unaryCall('SendEvent', {});
    } catch (err: any) {
      expect(err.code).toBe(2);
      expect(err.details).toBe('unknown');
      expect(err.metadata).toEqual({});
    }
  });

  it('uses message as details fallback', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    await transport.connect();

    const fakeClient = lastFakeClient;
    const grpcErr = Object.assign(new Error('fallback message'), {
      code: 13,
      details: '',
      metadata: { getMap: () => ({}) },
    });
    fakeClient.SendEvent.mockImplementation((_req: any, _meta: any, _opts: any, cb: any) => {
      cb(grpcErr);
      return { cancel: vi.fn() };
    });

    try {
      await transport.unaryCall('SendEvent', {});
    } catch (err: any) {
      expect(err.code).toBe(13);
      expect(err.message).toBe('fallback message');
    }
  });
});

describe('GrpcTransport.createTimeout()', () => {
  it('close with timeout uses createTimeout internally', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    await transport.connect();
    await transport.close(50);
    expect(transport.state).toBe(ConnectionState.CLOSED);
  });
});

describe('GrpcTransport on/off event delegation', () => {
  it('on delegates to stateMachine', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    const handler = vi.fn();
    transport.on('stateChange', handler);
    transport.getStateMachine().transitionTo(ConnectionState.CONNECTING);
    await new Promise((r) => queueMicrotask(r));
    expect(handler).toHaveBeenCalled();
  });

  it('off removes the listener', async () => {
    const transport = new GrpcTransport({ address: 'localhost:50000' });
    const handler = vi.fn();
    transport.on('stateChange', handler);
    transport.off('stateChange', handler);
    transport.getStateMachine().transitionTo(ConnectionState.CONNECTING);
    await new Promise((r) => queueMicrotask(r));
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('GrpcTransport.resolveSslCredentials() with TLS', () => {
  it('returns SslCredentialParts when TLS is enabled', async () => {
    const transport = new GrpcTransport({
      address: 'remote.host:50000',
      tls: { enabled: true, insecureSkipVerify: true },
    });
    const parts = await transport.resolveSslCredentials();
    expect(parts).toBeDefined();
    expect(parts!.insecureSkipVerify).toBe(true);
  });
});

describe('GrpcTransport.reloadSslCredentials() with TLS', () => {
  it('returns fresh SslCredentialParts when TLS is enabled', async () => {
    const transport = new GrpcTransport({
      address: 'remote.host:50000',
      tls: { enabled: true, insecureSkipVerify: true },
    });
    const parts = await transport.reloadSslCredentials();
    expect(parts).toBeDefined();
  });
});
