import { describe, it, expect, vi } from 'vitest';
import { SubscriptionTracker } from '../../src/internal/transport/subscription-tracker.js';

describe('SubscriptionTracker', () => {
  it('registers and retrieves a subscription', () => {
    const tracker = new SubscriptionTracker();
    const resubscribe = vi.fn();
    tracker.register({
      id: 'sub-1',
      pattern: 'events',
      channel: 'ch1',
      resubscribe,
    });
    expect(tracker.count).toBe(1);
    const sub = tracker.get('sub-1');
    expect(sub).toBeDefined();
    expect(sub!.channel).toBe('ch1');
    expect(sub!.pattern).toBe('events');
  });

  it('returns undefined for unknown subscription id', () => {
    const tracker = new SubscriptionTracker();
    expect(tracker.get('nonexistent')).toBeUndefined();
  });

  it('unregisters a subscription', () => {
    const tracker = new SubscriptionTracker();
    tracker.register({ id: 'sub-1', pattern: 'events', channel: 'ch1', resubscribe: vi.fn() });
    tracker.unregister('sub-1');
    expect(tracker.count).toBe(0);
    expect(tracker.get('sub-1')).toBeUndefined();
  });

  it('tracks and updates sequence for events-store subscriptions', () => {
    const tracker = new SubscriptionTracker();
    tracker.register({ id: 'es-1', pattern: 'events-store', channel: 'ch1', resubscribe: vi.fn() });
    tracker.updateSequence('es-1', 42);
    const sub = tracker.get('es-1');
    expect(sub!.lastSequence).toBe(42);
    tracker.updateSequence('es-1', 100);
    expect(sub!.lastSequence).toBe(100);
  });

  it('does not update sequence for non events-store patterns', () => {
    const tracker = new SubscriptionTracker();
    tracker.register({ id: 'ev-1', pattern: 'events', channel: 'ch1', resubscribe: vi.fn() });
    tracker.updateSequence('ev-1', 42);
    expect(tracker.get('ev-1')!.lastSequence).toBeUndefined();
  });

  it('resubscribeAll calls resubscribe on every registered subscription', () => {
    const tracker = new SubscriptionTracker();
    const resub1 = vi.fn();
    const resub2 = vi.fn();
    const resub3 = vi.fn();
    tracker.register({ id: 's1', pattern: 'events', channel: 'ch1', resubscribe: resub1 });
    tracker.register({ id: 's2', pattern: 'commands', channel: 'ch2', resubscribe: resub2 });
    tracker.register({ id: 's3', pattern: 'queries', channel: 'ch3', resubscribe: resub3 });

    tracker.resubscribeAll();

    expect(resub1).toHaveBeenCalledOnce();
    expect(resub2).toHaveBeenCalledOnce();
    expect(resub3).toHaveBeenCalledOnce();
  });

  it('clear removes all subscriptions', () => {
    const tracker = new SubscriptionTracker();
    tracker.register({ id: 's1', pattern: 'events', channel: 'ch1', resubscribe: vi.fn() });
    tracker.register({ id: 's2', pattern: 'commands', channel: 'ch2', resubscribe: vi.fn() });
    tracker.clear();
    expect(tracker.count).toBe(0);
    expect(tracker.get('s1')).toBeUndefined();
  });

  it('sequence is preserved across resubscribeAll for events-store', () => {
    const tracker = new SubscriptionTracker();
    const resubscribe = vi.fn();
    tracker.register({ id: 'es-1', pattern: 'events-store', channel: 'ch1', resubscribe });

    tracker.updateSequence('es-1', 50);
    tracker.resubscribeAll();

    const sub = tracker.get('es-1');
    expect(sub!.lastSequence).toBe(50);
    expect(resubscribe).toHaveBeenCalledOnce();
  });
});
