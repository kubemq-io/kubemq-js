import { describe, it, expect } from 'vitest';
import { StreamManager } from '../../src/internal/transport/stream-manager.js';
import { StreamBrokenError } from '../../src/errors.js';
import { createTestLogger } from '../fixtures/test-helpers.js';

describe('StreamManager', () => {
  const policy = {
    maxRetries: 3,
    initialBackoffMs: 100,
    maxBackoffMs: 1000,
    multiplier: 2,
    jitter: 'none' as const,
  };

  it('starts in idle state', () => {
    const mgr = new StreamManager(policy, createTestLogger());
    expect(mgr.state).toBe('idle');
  });

  it('activate transitions to active and resets backoff', () => {
    const mgr = new StreamManager(policy, createTestLogger());
    mgr.getReconnectDelay();
    mgr.activate();
    expect(mgr.state).toBe('active');
  });

  it('tracks in-flight messages', () => {
    const mgr = new StreamManager(policy, createTestLogger());
    mgr.trackSend('msg-1');
    mgr.trackSend('msg-2');
    expect(mgr.pendingCount).toBe(2);
    mgr.acknowledgeMessage('msg-1');
    expect(mgr.pendingCount).toBe(1);
  });

  it('handleStreamBreak returns StreamBrokenError with unacked IDs', () => {
    const mgr = new StreamManager(policy, createTestLogger());
    mgr.trackSend('msg-1');
    mgr.trackSend('msg-2');
    mgr.acknowledgeMessage('msg-1');

    const err = mgr.handleStreamBreak(new Error('RST_STREAM'));
    expect(err).toBeInstanceOf(StreamBrokenError);
    expect(err.unacknowledgedMessageIds).toEqual(['msg-2']);
    expect(err.isRetryable).toBe(true);
    expect(mgr.state).toBe('reconnecting');
    expect(mgr.pendingCount).toBe(0);
  });

  it('handleStreamBreak clears in-flight tracking', () => {
    const mgr = new StreamManager(policy, createTestLogger());
    mgr.trackSend('msg-1');
    mgr.handleStreamBreak(new Error('broken'));
    expect(mgr.pendingCount).toBe(0);
  });

  it('returns increasing reconnect delays', () => {
    const mgr = new StreamManager(policy, createTestLogger());
    const d1 = mgr.getReconnectDelay();
    const d2 = mgr.getReconnectDelay();
    expect(d2).toBeGreaterThanOrEqual(d1);
  });

  it('resetReconnectState resets backoff counter', () => {
    const mgr = new StreamManager(policy, createTestLogger());
    mgr.getReconnectDelay();
    mgr.getReconnectDelay();
    mgr.resetReconnectState();
    const d = mgr.getReconnectDelay();
    expect(d).toBeLessThanOrEqual(policy.initialBackoffMs);
  });

  it('isReconnectExhausted returns true after exceeding maxRetries', () => {
    const mgr = new StreamManager({ ...policy, maxRetries: 2 }, createTestLogger());
    expect(mgr.isReconnectExhausted()).toBe(false);
    mgr.getReconnectDelay();
    mgr.getReconnectDelay();
    mgr.getReconnectDelay();
    expect(mgr.isReconnectExhausted()).toBe(true);
  });

  it('isFatalStreamError returns true for auth errors', () => {
    const mgr = new StreamManager(policy, createTestLogger());
    expect(mgr.isFatalStreamError(7)).toBe(true);
    expect(mgr.isFatalStreamError(16)).toBe(true);
  });

  it('isFatalStreamError returns false for transient errors', () => {
    const mgr = new StreamManager(policy, createTestLogger());
    expect(mgr.isFatalStreamError(14)).toBe(false);
    expect(mgr.isFatalStreamError(2)).toBe(false);
  });

  it('close marks stream as closed and clears in-flight', () => {
    const mgr = new StreamManager(policy, createTestLogger());
    mgr.trackSend('msg-1');
    mgr.close();
    expect(mgr.state).toBe('closed');
    expect(mgr.pendingCount).toBe(0);
  });

  it('isFatalStreamError returns true when stream is closed', () => {
    const mgr = new StreamManager(policy, createTestLogger());
    mgr.close();
    expect(mgr.isFatalStreamError(14)).toBe(true);
  });
});
