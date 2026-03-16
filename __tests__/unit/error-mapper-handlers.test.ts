import { describe, it, expect, vi } from 'vitest';
import { wrapHandler, resolveErrorHandler } from '../../src/internal/middleware/error-mapper.js';
import { HandlerError, KubeMQError } from '../../src/errors.js';

describe('wrapHandler', () => {
  it('calls through to the original handler on success', () => {
    const handler = vi.fn();
    const onError = vi.fn();
    const wrapped = wrapHandler(handler, onError);

    wrapped('test-message');
    expect(handler).toHaveBeenCalledWith('test-message');
    expect(onError).not.toHaveBeenCalled();
  });

  it('catches handler exceptions and reports HandlerError via onError', () => {
    const handler = () => {
      throw new Error('user handler bug');
    };
    const errors: KubeMQError[] = [];
    const onError = (err: KubeMQError) => errors.push(err);
    const wrapped = wrapHandler(handler, onError);

    wrapped('msg');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(HandlerError);
    expect(errors[0]!.message).toContain('user handler bug');
  });

  it('handles non-Error throws', () => {
    const handler = () => {
      throw 'string-error';
    };
    const errors: KubeMQError[] = [];
    const wrapped = wrapHandler(handler, (err) => errors.push(err));

    wrapped('msg');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toContain('string-error');
  });
});

describe('resolveErrorHandler', () => {
  it('returns user-provided callback when present', () => {
    const onError = vi.fn();
    const resolved = resolveErrorHandler(onError, { error: vi.fn() });
    expect(resolved).toBe(onError);
  });

  it('falls back to logger.error when no callback provided', () => {
    const logError = vi.fn();
    const resolved = resolveErrorHandler(undefined, { error: logError });

    const err = new HandlerError({
      message: 'test',
      operation: 'handler',
    });
    resolved(err);
    expect(logError).toHaveBeenCalledTimes(1);
  });
});
