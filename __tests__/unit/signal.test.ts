import { describe, it, expect } from 'vitest';
import {
  resolveSignal,
  mapAbortReason,
  throwIfAborted,
} from '../../src/internal/concurrency/signal.js';
import { CancellationError, KubeMQTimeoutError } from '../../src/errors.js';

const DEFAULT_TIMEOUT = 5000;

describe('resolveSignal', () => {
  it('returns user signal when only signal is provided', () => {
    const ac = new AbortController();
    const resolved = resolveSignal(DEFAULT_TIMEOUT, { signal: ac.signal });

    expect(resolved).toBe(ac.signal);
    expect(resolved.aborted).toBe(false);
  });

  it('returns timeout signal when only timeout is provided', () => {
    const resolved = resolveSignal(DEFAULT_TIMEOUT, { timeout: 10_000 });

    expect(resolved).toBeDefined();
    expect(resolved.aborted).toBe(false);
  });

  it('composes signal and timeout when both are provided', () => {
    const ac = new AbortController();
    const resolved = resolveSignal(DEFAULT_TIMEOUT, {
      signal: ac.signal,
      timeout: 10_000,
    });

    expect(resolved).not.toBe(ac.signal);
    expect(resolved.aborted).toBe(false);

    ac.abort();
    expect(resolved.aborted).toBe(true);
  });

  it('returns default timeout signal when neither signal nor timeout is provided', () => {
    const resolved = resolveSignal(DEFAULT_TIMEOUT);
    expect(resolved).toBeDefined();
    expect(resolved.aborted).toBe(false);
  });

  it('returns default timeout signal for empty options object', () => {
    const resolved = resolveSignal(DEFAULT_TIMEOUT, {});
    expect(resolved).toBeDefined();
    expect(resolved.aborted).toBe(false);
  });

  it('composes correctly: user abort propagates through combined signal', () => {
    const ac = new AbortController();
    const combined = resolveSignal(DEFAULT_TIMEOUT, { signal: ac.signal, timeout: 60_000 });

    expect(combined.aborted).toBe(false);
    ac.abort(new Error('user cancel'));
    expect(combined.aborted).toBe(true);
  });
});

describe('mapAbortReason', () => {
  it('maps DOMException TimeoutError to KubeMQTimeoutError', () => {
    const reason = new DOMException('timed out', 'TimeoutError');
    const err = mapAbortReason(reason, 'sendCommand', 'cmd.ch');

    expect(err).toBeInstanceOf(KubeMQTimeoutError);
    expect(err.operation).toBe('sendCommand');
    expect(err.channel).toBe('cmd.ch');
    expect(err.isRetryable).toBe(true);
  });

  it('maps non-timeout DOMException to CancellationError', () => {
    const reason = new DOMException('aborted', 'AbortError');
    const err = mapAbortReason(reason, 'ping');

    expect(err).toBeInstanceOf(CancellationError);
    expect(err.isRetryable).toBe(false);
  });

  it('maps plain Error to CancellationError with cause', () => {
    const reason = new Error('user cancelled');
    const err = mapAbortReason(reason, 'query');

    expect(err).toBeInstanceOf(CancellationError);
    expect(err.cause).toBe(reason);
  });

  it('maps non-Error value to CancellationError without cause', () => {
    const err = mapAbortReason('string-reason', 'op');

    expect(err).toBeInstanceOf(CancellationError);
    expect(err.cause).toBeUndefined();
  });
});

describe('throwIfAborted', () => {
  it('does nothing when signal is not aborted', () => {
    const ac = new AbortController();
    expect(() => throwIfAborted(ac.signal, 'op')).not.toThrow();
  });

  it('throws CancellationError for user-aborted signal', () => {
    const ac = new AbortController();
    ac.abort(new Error('cancelled'));

    expect(() => throwIfAborted(ac.signal, 'sendEvent', 'ch')).toThrow(CancellationError);
  });

  it('throws KubeMQTimeoutError for timeout-aborted signal', () => {
    const ac = new AbortController();
    ac.abort(new DOMException('timeout', 'TimeoutError'));

    expect(() => throwIfAborted(ac.signal, 'sendQuery', 'q.ch')).toThrow(KubeMQTimeoutError);
  });

  it('includes channel in the thrown error', () => {
    const ac = new AbortController();
    ac.abort(new Error('test'));

    try {
      throwIfAborted(ac.signal, 'op', 'my-channel');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(CancellationError);
      expect((err as CancellationError).channel).toBe('my-channel');
    }
  });
});
