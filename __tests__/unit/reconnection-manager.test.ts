import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReconnectionManager } from '../../src/internal/transport/reconnection-manager.js';
import type { ReconnectionPolicy } from '../../src/options.js';

function createMockLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function createMockStateMachine() {
  return {
    transitionTo: vi.fn(),
  };
}

describe('ReconnectionManager', () => {
  let logger: ReturnType<typeof createMockLogger>;
  let stateMachine: ReturnType<typeof createMockStateMachine>;

  beforeEach(() => {
    logger = createMockLogger();
    stateMachine = createMockStateMachine();
  });

  it('reconnects successfully on first attempt', async () => {
    const policy: ReconnectionPolicy = {
      maxAttempts: 3,
      initialDelayMs: 1,
      maxDelayMs: 10,
      multiplier: 2,
      jitter: 'none',
    };
    const manager = new ReconnectionManager(policy, stateMachine as any, logger);
    const connectFn = vi.fn().mockResolvedValue(undefined);

    await manager.reconnect(connectFn);

    expect(connectFn).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith('Reconnection successful', expect.any(Object));
  });

  it('retries on failure then succeeds', async () => {
    const policy: ReconnectionPolicy = {
      maxAttempts: 5,
      initialDelayMs: 1,
      maxDelayMs: 10,
      multiplier: 2,
      jitter: 'none',
    };
    const manager = new ReconnectionManager(policy, stateMachine as any, logger);
    const connectFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue(undefined);

    await manager.reconnect(connectFn);

    expect(connectFn).toHaveBeenCalledTimes(3);
    expect(logger.warn).toHaveBeenCalledTimes(2);
    expect(logger.info).toHaveBeenCalledWith('Reconnection successful', expect.any(Object));
  });

  it('exhausts after maxAttempts', async () => {
    const policy: ReconnectionPolicy = {
      maxAttempts: 2,
      initialDelayMs: 1,
      maxDelayMs: 10,
      multiplier: 2,
      jitter: 'none',
    };
    const manager = new ReconnectionManager(policy, stateMachine as any, logger);
    const connectFn = vi.fn().mockRejectedValue(new Error('always fails'));

    await manager.reconnect(connectFn);

    expect(connectFn).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith('Reconnection exhausted', expect.any(Object));
  });

  it('cancel() stops reconnection', async () => {
    const policy: ReconnectionPolicy = {
      maxAttempts: 100,
      initialDelayMs: 1,
      maxDelayMs: 10,
      multiplier: 1,
      jitter: 'none',
    };
    const manager = new ReconnectionManager(policy, stateMachine as any, logger);
    let callCount = 0;
    const connectFn = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount >= 2) {
        manager.cancel();
      }
      throw new Error('fail');
    });

    await manager.reconnect(connectFn);

    expect(connectFn.mock.calls.length).toBeLessThanOrEqual(3);
    expect(logger.error).not.toHaveBeenCalledWith('Reconnection exhausted', expect.any(Object));
  });

  it('calculates backoff with jitter "none"', async () => {
    const policy: ReconnectionPolicy = {
      maxAttempts: 1,
      initialDelayMs: 5,
      maxDelayMs: 100,
      multiplier: 2,
      jitter: 'none',
    };
    const manager = new ReconnectionManager(policy, stateMachine as any, logger);
    const connectFn = vi.fn().mockResolvedValue(undefined);

    const start = Date.now();
    await manager.reconnect(connectFn);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(4);
    expect(connectFn).toHaveBeenCalledTimes(1);
  });

  it('calculates backoff with jitter "full"', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const policy: ReconnectionPolicy = {
      maxAttempts: 1,
      initialDelayMs: 10,
      maxDelayMs: 100,
      multiplier: 2,
      jitter: 'full',
    };
    const manager = new ReconnectionManager(policy, stateMachine as any, logger);
    const connectFn = vi.fn().mockResolvedValue(undefined);

    await manager.reconnect(connectFn);

    expect(connectFn).toHaveBeenCalledTimes(1);
    vi.spyOn(Math, 'random').mockRestore();
  });

  it('calculates backoff with jitter "equal"', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const policy: ReconnectionPolicy = {
      maxAttempts: 1,
      initialDelayMs: 10,
      maxDelayMs: 100,
      multiplier: 2,
      jitter: 'equal',
    };
    const manager = new ReconnectionManager(policy, stateMachine as any, logger);
    const connectFn = vi.fn().mockResolvedValue(undefined);

    await manager.reconnect(connectFn);

    expect(connectFn).toHaveBeenCalledTimes(1);
    vi.spyOn(Math, 'random').mockRestore();
  });

  it('transitions state machine to RECONNECTING on each attempt', async () => {
    const policy: ReconnectionPolicy = {
      maxAttempts: 3,
      initialDelayMs: 1,
      maxDelayMs: 10,
      multiplier: 2,
      jitter: 'none',
    };
    const manager = new ReconnectionManager(policy, stateMachine as any, logger);
    const connectFn = vi.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValue(undefined);

    await manager.reconnect(connectFn);

    const reconnectingCalls = stateMachine.transitionTo.mock.calls.filter(
      ([state]: [string]) => state === 'RECONNECTING',
    );
    expect(reconnectingCalls.length).toBe(2);
  });

  it('sleep resolves immediately if signal is already aborted', async () => {
    const policy: ReconnectionPolicy = {
      maxAttempts: 5,
      initialDelayMs: 10_000,
      maxDelayMs: 10_000,
      multiplier: 1,
      jitter: 'none',
    };
    const manager = new ReconnectionManager(policy, stateMachine as any, logger);
    stateMachine.transitionTo.mockImplementation(() => {
      manager.cancel();
    });
    const connectFn = vi.fn().mockRejectedValue(new Error('fail'));

    const start = Date.now();
    await manager.reconnect(connectFn);
    expect(Date.now() - start).toBeLessThan(5000);
    expect(connectFn).not.toHaveBeenCalled();
  });

  it('cancel during sleep resolves sleep early', async () => {
    const policy: ReconnectionPolicy = {
      maxAttempts: 5,
      initialDelayMs: 5000,
      maxDelayMs: 10_000,
      multiplier: 2,
      jitter: 'none',
    };
    const manager = new ReconnectionManager(policy, stateMachine as any, logger);
    const connectFn = vi.fn().mockRejectedValue(new Error('fail'));

    setTimeout(() => manager.cancel(), 50);

    const start = Date.now();
    await manager.reconnect(connectFn);
    expect(Date.now() - start).toBeLessThan(5000);
  });

  it('transitions state machine to READY on success', async () => {
    const policy: ReconnectionPolicy = {
      maxAttempts: 3,
      initialDelayMs: 1,
      maxDelayMs: 10,
      multiplier: 2,
      jitter: 'none',
    };
    const manager = new ReconnectionManager(policy, stateMachine as any, logger);
    const connectFn = vi.fn().mockResolvedValue(undefined);

    await manager.reconnect(connectFn);

    const readyCalls = stateMachine.transitionTo.mock.calls.filter(
      ([state]: [string]) => state === 'READY',
    );
    expect(readyCalls.length).toBe(1);
  });
});
