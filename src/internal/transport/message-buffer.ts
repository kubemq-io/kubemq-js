/** @internal */

import { BufferFullError, ErrorCode } from '../../errors.js';
import type { Logger } from '../../logger.js';

export interface BufferedMessage {
  data: Uint8Array;
  operation: string;
  channel: string;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  bufferedAt: number;
}

export class MessageBuffer {
  private readonly maxSizeBytes: number;
  private readonly mode: 'error' | 'block';
  private readonly logger: Logger;
  private readonly queue: BufferedMessage[] = [];
  private currentSizeBytes = 0;
  private drainWaiters: { resolve: () => void; reject: (err: Error) => void }[] = [];

  constructor(maxSizeBytes: number, mode: 'error' | 'block', logger: Logger) {
    this.maxSizeBytes = maxSizeBytes;
    this.mode = mode;
    this.logger = logger;
  }

  get size(): number {
    return this.queue.length;
  }

  get sizeBytes(): number {
    return this.currentSizeBytes;
  }

  async enqueue(msg: BufferedMessage): Promise<void> {
    const msgSize = msg.data.byteLength;

    while (this.currentSizeBytes + msgSize > this.maxSizeBytes) {
      if (this.mode === 'error') {
        throw new BufferFullError({
          code: ErrorCode.BufferFull,
          message: `Reconnection buffer full (${String(this.currentSizeBytes)}/${String(this.maxSizeBytes)} bytes). Message dropped.`,
          operation: msg.operation,
          channel: msg.channel,
          isRetryable: false,
          suggestion: 'Increase reconnectBufferSize or switch to reconnectBufferMode: "block"',
        });
      }
      await new Promise<void>((resolve, reject) => {
        this.drainWaiters.push({ resolve, reject });
      });
    }

    this.queue.push(msg);
    this.currentSizeBytes += msgSize;
    this.logger.debug('Message buffered', {
      operation: msg.operation,
      channel: msg.channel,
      bufferSize: this.currentSizeBytes,
      bufferCount: this.queue.length,
    });
  }

  async flush(sendFn: (msg: BufferedMessage) => Promise<void>): Promise<number> {
    let flushed = 0;
    while (this.queue.length > 0) {
      const msg = this.queue.shift();
      if (!msg) break;
      this.currentSizeBytes -= msg.data.byteLength;
      try {
        await sendFn(msg);
        flushed++;
      } catch (err: unknown) {
        msg.reject(err);
      }
    }

    for (const waiter of this.drainWaiters) {
      waiter.resolve();
    }
    this.drainWaiters = [];

    this.logger.info('Buffer flushed', { messagesFlushed: flushed });
    return flushed;
  }

  rejectAll(err: Error): void {
    const waiters = this.drainWaiters;
    this.drainWaiters = [];
    for (const waiter of waiters) {
      waiter.reject(err);
    }
  }

  discard(): number {
    const count = this.queue.length;
    for (const msg of this.queue) {
      msg.reject(
        new BufferFullError({
          code: ErrorCode.BufferFull,
          message: 'Connection closed — buffered message discarded',
          operation: msg.operation,
          channel: msg.channel,
          isRetryable: false,
        }),
      );
    }
    this.queue.length = 0;
    this.currentSizeBytes = 0;

    this.rejectAll(
      new BufferFullError({
        code: ErrorCode.BufferFull,
        message: 'Buffer discarded — connection closed',
        operation: 'buffer.discard',
        isRetryable: false,
      }),
    );

    if (count > 0) {
      this.logger.warn('Buffer discarded', { discardedCount: count });
    }
    return count;
  }
}
