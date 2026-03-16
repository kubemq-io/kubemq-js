import { describe, it, expect, vi } from 'vitest';
import { TagsCarrier, TracePropagation } from '../../src/internal/telemetry/trace-propagation.js';

function createMockLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe('TagsCarrier', () => {
  it('get returns the value for a key', () => {
    const tags = new Map([['traceparent', '00-abc-def-01']]);
    const carrier = new TagsCarrier(tags);

    expect(carrier.get('traceparent')).toBe('00-abc-def-01');
  });

  it('get returns undefined for missing key', () => {
    const carrier = new TagsCarrier(new Map());
    expect(carrier.get('missing')).toBeUndefined();
  });

  it('set adds a key-value pair', () => {
    const tags = new Map<string, string>();
    const carrier = new TagsCarrier(tags);

    carrier.set('traceparent', 'value');
    expect(tags.get('traceparent')).toBe('value');
  });

  it('keys returns all keys', () => {
    const tags = new Map([
      ['a', '1'],
      ['b', '2'],
    ]);
    const carrier = new TagsCarrier(tags);

    expect(carrier.keys()).toEqual(['a', 'b']);
  });
});

describe('TracePropagation', () => {
  it('isEnabled is false when api is undefined', () => {
    const tp = new TracePropagation(undefined, createMockLogger());
    expect(tp.isEnabled).toBe(false);
  });

  it('isEnabled is true when api is provided', () => {
    const mockApi = {} as never;
    const tp = new TracePropagation(mockApi, createMockLogger());
    expect(tp.isEnabled).toBe(true);
  });

  it('inject is a no-op when api is undefined', () => {
    const tp = new TracePropagation(undefined, createMockLogger());
    const tags = new Map<string, string>();

    tp.inject(tags);

    expect(tags.size).toBe(0);
  });

  it('extract returns undefined when api is undefined', () => {
    const tp = new TracePropagation(undefined, createMockLogger());
    const tags = new Map<string, string>();

    expect(tp.extract(tags)).toBeUndefined();
  });

  it('createLink returns undefined when api is undefined', () => {
    const tp = new TracePropagation(undefined, createMockLogger());
    expect(tp.createLink({} as never)).toBeUndefined();
  });

  it('createBatchLinks returns empty array when api is undefined', () => {
    const tp = new TracePropagation(undefined, createMockLogger());
    const messages = [{ tags: new Map<string, string>() }];

    expect(tp.createBatchLinks(messages)).toEqual([]);
  });

  it('createBatchLinks caps at 128 links', () => {
    const mockSpanContext = {
      traceId: 'trace-id',
      spanId: 'span-id',
      traceFlags: 1,
    };
    const mockContext = Symbol('context');
    const mockApi = {
      ROOT_CONTEXT: Symbol('root'),
      context: { active: () => mockContext },
      propagation: {
        inject: vi.fn(),
        extract: vi.fn(() => mockContext),
      },
      trace: {
        getSpanContext: vi.fn(() => mockSpanContext),
      },
      isSpanContextValid: vi.fn(() => true),
    };

    const tp = new TracePropagation(mockApi as never, createMockLogger());

    const messages = Array.from({ length: 200 }, () => ({
      tags: new Map<string, string>(),
    }));

    const links = tp.createBatchLinks(messages);
    expect(links.length).toBe(128);
  });

  it('inject delegates to propagation.inject with active context', () => {
    const mockContext = Symbol('active-ctx');
    const mockApi = {
      context: { active: () => mockContext },
      propagation: {
        inject: vi.fn(),
      },
    };

    const tp = new TracePropagation(mockApi as never, createMockLogger());
    const tags = new Map<string, string>();

    tp.inject(tags);

    expect(mockApi.propagation.inject).toHaveBeenCalledOnce();
    expect(mockApi.propagation.inject).toHaveBeenCalledWith(
      mockContext,
      expect.any(TagsCarrier),
      expect.anything(),
    );
  });

  it('createLink returns undefined when span context is invalid', () => {
    const mockApi = {
      trace: { getSpanContext: vi.fn(() => ({ traceId: '0', spanId: '0' })) },
      isSpanContextValid: vi.fn(() => false),
    };

    const tp = new TracePropagation(mockApi as never, createMockLogger());

    expect(tp.createLink({} as never)).toBeUndefined();
  });
});
