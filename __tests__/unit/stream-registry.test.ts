import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StreamRegistry } from '../../src/internal/transport/stream-registry.js';

function createMockLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function createMockStream() {
  return { destroy: vi.fn() };
}

describe('StreamRegistry', () => {
  let logger: ReturnType<typeof createMockLogger>;
  let registry: StreamRegistry;

  beforeEach(() => {
    logger = createMockLogger();
    registry = new StreamRegistry(logger);
  });

  it('starts with size 0', () => {
    expect(registry.size).toBe(0);
  });

  it('register increases size', () => {
    registry.register('s1', createMockStream(), 'events');
    expect(registry.size).toBe(1);

    registry.register('s2', createMockStream(), 'queries');
    expect(registry.size).toBe(2);
  });

  it('unregister calls destroy and decreases size', () => {
    const stream = createMockStream();
    registry.register('s1', stream, 'events');
    expect(registry.size).toBe(1);

    registry.unregister('s1');
    expect(stream.destroy).toHaveBeenCalledOnce();
    expect(registry.size).toBe(0);
  });

  it('unregister on unknown id is a no-op', () => {
    registry.unregister('nonexistent');
    expect(registry.size).toBe(0);
  });

  it('register with same id destroys the old stream', () => {
    const old = createMockStream();
    const replacement = createMockStream();

    registry.register('s1', old, 'events');
    registry.register('s1', replacement, 'events-v2');

    expect(old.destroy).toHaveBeenCalledOnce();
    expect(replacement.destroy).not.toHaveBeenCalled();
    expect(registry.size).toBe(1);
  });

  it('destroyAll destroys all registered streams', () => {
    const s1 = createMockStream();
    const s2 = createMockStream();
    const s3 = createMockStream();

    registry.register('a', s1, 'events');
    registry.register('b', s2, 'queries');
    registry.register('c', s3, 'commands');

    registry.destroyAll();

    expect(s1.destroy).toHaveBeenCalledOnce();
    expect(s2.destroy).toHaveBeenCalledOnce();
    expect(s3.destroy).toHaveBeenCalledOnce();
    expect(registry.size).toBe(0);
  });

  it('tolerates stream.destroy() throwing', () => {
    const stream = {
      destroy: vi.fn(() => {
        throw new Error('boom');
      }),
    };
    registry.register('s1', stream, 'events');

    expect(() => registry.unregister('s1')).not.toThrow();
    expect(registry.size).toBe(0);
  });
});
