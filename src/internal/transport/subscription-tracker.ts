/** @internal */

export interface TrackedSubscription {
  readonly id: string;
  readonly pattern: 'events' | 'events-store' | 'commands' | 'queries' | 'queue-stream';
  readonly channel: string;
  readonly group?: string;
  lastSequence?: number;
  resubscribe: () => void;
}

export class SubscriptionTracker {
  private readonly subscriptions = new Map<string, TrackedSubscription>();

  register(sub: TrackedSubscription): void {
    this.subscriptions.set(sub.id, sub);
  }

  unregister(id: string): void {
    this.subscriptions.delete(id);
  }

  get(id: string): TrackedSubscription | undefined {
    return this.subscriptions.get(id);
  }

  updateSequence(id: string, sequence: number): void {
    const sub = this.subscriptions.get(id);
    if (sub?.pattern === 'events-store') {
      sub.lastSequence = sequence;
    }
  }

  resubscribeAll(): void {
    for (const sub of this.subscriptions.values()) {
      sub.resubscribe();
    }
  }

  get count(): number {
    return this.subscriptions.size;
  }

  clear(): void {
    this.subscriptions.clear();
  }
}
