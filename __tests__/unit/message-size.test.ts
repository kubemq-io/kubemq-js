import { describe, it, expect } from 'vitest';
import { validateMessageSize } from '../../src/internal/validation/message-size.js';
import { ValidationError, ErrorCode } from '../../src/errors.js';

describe('validateMessageSize', () => {
  const operation = 'sendEvent';
  const channel = 'test-channel';

  it('passes when body is under the limit', () => {
    const body = new Uint8Array(100);
    expect(() => validateMessageSize(body, 1024, operation, channel)).not.toThrow();
  });

  it('passes when body is exactly at the limit', () => {
    const body = new Uint8Array(1024);
    expect(() => validateMessageSize(body, 1024, operation, channel)).not.toThrow();
  });

  it('throws ValidationError when body exceeds the limit', () => {
    const body = new Uint8Array(1025);
    expect(() => validateMessageSize(body, 1024, operation, channel)).toThrow(ValidationError);
  });

  it('thrown error has correct fields', () => {
    const body = new Uint8Array(2048);
    try {
      validateMessageSize(body, 1024, operation, channel);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      const ve = err as ValidationError;
      expect(ve.code).toBe(ErrorCode.ValidationFailed);
      expect(ve.operation).toBe(operation);
      expect(ve.channel).toBe(channel);
      expect(ve.isRetryable).toBe(false);
      expect(ve.message).toContain('2048');
      expect(ve.message).toContain('1024');
    }
  });

  it('works without optional channel parameter', () => {
    const body = new Uint8Array(2048);
    expect(() => validateMessageSize(body, 1024, operation)).toThrow(ValidationError);
  });
});
