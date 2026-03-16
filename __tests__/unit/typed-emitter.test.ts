import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SafeEventEmitter } from '../../src/internal/transport/typed-emitter.js';

interface TestEvents {
  data: (value: string) => void;
  error: (err: Error) => void;
  empty: () => void;
}

describe('SafeEventEmitter', () => {
  let emitter: SafeEventEmitter<TestEvents>;

  beforeEach(() => {
    emitter = new SafeEventEmitter<TestEvents>();
  });

  it('emit calls registered listeners', () => {
    const listener = vi.fn();
    emitter.on('data', listener);

    emitter.emit('data', 'hello');

    expect(listener).toHaveBeenCalledWith('hello');
  });

  it('emit returns true when listeners exist', () => {
    emitter.on('data', () => {});
    expect(emitter.emit('data', 'test')).toBe(true);
  });

  it('emit returns false when no listeners exist', () => {
    expect(emitter.emit('data', 'test')).toBe(false);
  });

  it('emit catches thrown errors and returns false', () => {
    emitter.on('data', () => {
      throw new Error('listener boom');
    });

    const result = emitter.emit('data', 'test');
    expect(result).toBe(false);
  });

  it('emit does not propagate listener exceptions', () => {
    emitter.on('data', () => {
      throw new Error('boom');
    });

    expect(() => emitter.emit('data', 'test')).not.toThrow();
  });

  it('setLogger enables warn logging on thrown errors', () => {
    const logger = { warn: vi.fn() };
    emitter.setLogger(logger);

    emitter.on('data', () => {
      throw new Error('kaboom');
    });

    emitter.emit('data', 'test');

    expect(logger.warn).toHaveBeenCalledWith(
      'Event handler threw an exception',
      expect.objectContaining({
        event: 'data',
        error: 'kaboom',
      }),
    );
  });

  it('works without logger set — errors are silently caught', () => {
    emitter.on('data', () => {
      throw new Error('silent');
    });

    expect(() => emitter.emit('data', 'test')).not.toThrow();
  });

  it('logger.warn receives stringified error for non-Error throws', () => {
    const logger = { warn: vi.fn() };
    emitter.setLogger(logger);

    emitter.on('empty', () => {
      throw 'string-error';
    });

    emitter.emit('empty');

    expect(logger.warn).toHaveBeenCalledWith(
      'Event handler threw an exception',
      expect.objectContaining({
        event: 'empty',
        error: 'string-error',
      }),
    );
  });
});
