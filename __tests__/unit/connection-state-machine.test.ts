import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConnectionStateMachine } from '../../src/internal/transport/connection-state-machine.js';
import { ConnectionState } from '../../src/internal/transport/connection-state.js';

function createMockLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('ConnectionStateMachine', () => {
  let logger: ReturnType<typeof createMockLogger>;
  let sm: ConnectionStateMachine;

  beforeEach(() => {
    logger = createMockLogger();
    sm = new ConnectionStateMachine(logger);
  });

  it('starts in IDLE state', () => {
    expect(sm.state).toBe(ConnectionState.IDLE);
  });

  it('valid transition changes state', () => {
    sm.transitionTo(ConnectionState.CONNECTING);
    expect(sm.state).toBe(ConnectionState.CONNECTING);
  });

  it('invalid transition stays at same state and logs warn', () => {
    sm.transitionTo(ConnectionState.READY);
    expect(sm.state).toBe(ConnectionState.IDLE);
    expect(logger.warn).toHaveBeenCalledWith('Invalid state transition attempted', {
      from: ConnectionState.IDLE,
      to: ConnectionState.READY,
    });
  });

  it('emits stateChange on valid transition', async () => {
    const listener = vi.fn();
    sm.on('stateChange', listener);

    sm.transitionTo(ConnectionState.CONNECTING);
    await flush();

    expect(listener).toHaveBeenCalledWith(ConnectionState.CONNECTING);
  });

  it('emits connected on CONNECTING → READY', async () => {
    const connected = vi.fn();
    sm.on('connected', connected);

    sm.transitionTo(ConnectionState.CONNECTING);
    sm.transitionTo(ConnectionState.READY);
    await flush();

    expect(connected).toHaveBeenCalledOnce();
  });

  it('emits reconnected on RECONNECTING → READY', async () => {
    const reconnected = vi.fn();
    sm.on('reconnected', reconnected);

    sm.transitionTo(ConnectionState.CONNECTING);
    sm.transitionTo(ConnectionState.READY);
    sm.transitionTo(ConnectionState.RECONNECTING);
    sm.transitionTo(ConnectionState.READY);
    await flush();

    expect(reconnected).toHaveBeenCalledOnce();
  });

  it('emits disconnected and reconnecting on → RECONNECTING', async () => {
    const disconnected = vi.fn();
    const reconnecting = vi.fn();
    sm.on('disconnected', disconnected);
    sm.on('reconnecting', reconnecting);

    sm.transitionTo(ConnectionState.CONNECTING);
    sm.transitionTo(ConnectionState.READY);
    sm.transitionTo(ConnectionState.RECONNECTING, { attempt: 1 });
    await flush();

    expect(disconnected).toHaveBeenCalledOnce();
    expect(reconnecting).toHaveBeenCalledWith(1);
  });

  it('emits closed on → CLOSED', async () => {
    const closed = vi.fn();
    sm.on('closed', closed);

    sm.transitionTo(ConnectionState.CONNECTING);
    sm.transitionTo(ConnectionState.CLOSED);
    await flush();

    expect(closed).toHaveBeenCalledOnce();
  });

  it('emits bufferDrain with discardedCount on → CLOSED', async () => {
    const bufferDrain = vi.fn();
    sm.on('bufferDrain', bufferDrain);

    sm.transitionTo(ConnectionState.CONNECTING);
    sm.transitionTo(ConnectionState.CLOSED, { discardedCount: 5 });
    await flush();

    expect(bufferDrain).toHaveBeenCalledWith(5);
  });

  it('does not emit bufferDrain when discardedCount is 0', async () => {
    const bufferDrain = vi.fn();
    sm.on('bufferDrain', bufferDrain);

    sm.transitionTo(ConnectionState.CONNECTING);
    sm.transitionTo(ConnectionState.CLOSED, { discardedCount: 0 });
    await flush();

    expect(bufferDrain).not.toHaveBeenCalled();
  });

  it('on/off adds and removes listeners', async () => {
    const listener = vi.fn();
    sm.on('stateChange', listener);

    sm.transitionTo(ConnectionState.CONNECTING);
    await flush();
    expect(listener).toHaveBeenCalledOnce();

    sm.off('stateChange', listener);

    sm.transitionTo(ConnectionState.READY);
    await flush();
    expect(listener).toHaveBeenCalledOnce();
  });

  it('reconnecting defaults attempt to 0 when meta is omitted', async () => {
    const reconnecting = vi.fn();
    sm.on('reconnecting', reconnecting);

    sm.transitionTo(ConnectionState.CONNECTING);
    sm.transitionTo(ConnectionState.READY);
    sm.transitionTo(ConnectionState.RECONNECTING);
    await flush();

    expect(reconnecting).toHaveBeenCalledWith(0);
  });
});
