/**
 * StreamRegistry — tracks active gRPC streams for lifecycle management.
 *
 * All streams created by the transport layer are registered here.
 * On `close()`, all tracked streams are destroyed to prevent leaks.
 * Replacing a stream with the same ID auto-destroys the old one.
 *
 * @internal
 */

import type { Logger } from '../../logger.js';

interface Destroyable {
  destroy(error?: Error): void;
}

interface TrackedStream {
  stream: Destroyable;
  purpose: string;
  createdAt: number;
}

export class StreamRegistry {
  private readonly streams = new Map<string, TrackedStream>();
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  register(id: string, stream: Destroyable, purpose: string): void {
    const existing = this.streams.get(id);
    if (existing) {
      this.destroyStream(id, 'replaced');
    }
    this.streams.set(id, { stream, purpose, createdAt: Date.now() });
    this.logger.debug('Stream registered', { id, purpose });
  }

  unregister(id: string): void {
    this.destroyStream(id, 'unregistered');
  }

  destroyAll(): void {
    for (const [id] of this.streams) {
      this.destroyStream(id, 'shutdown');
    }
  }

  get size(): number {
    return this.streams.size;
  }

  private destroyStream(id: string, reason: string): void {
    const tracked = this.streams.get(id);
    if (!tracked) return;

    try {
      tracked.stream.destroy();
    } catch {
      // Best-effort cleanup
    }
    this.streams.delete(id);
    this.logger.debug('Stream destroyed', { id, purpose: tracked.purpose, reason });
  }
}
