import { bench, describe } from 'vitest';
import {
  KubeMQError,
  ConnectionError,
  ValidationError,
  KubeMQTimeoutError,
  ErrorCode,
} from '../src/errors.js';

describe('Error class instantiation', () => {
  bench('KubeMQError — base class', () => {
    new KubeMQError({
      message: 'benchmark error',
      operation: 'bench',
      code: ErrorCode.Fatal,
    });
  });

  bench('ConnectionError', () => {
    new ConnectionError({
      message: 'connection failed',
      operation: 'connect',
    });
  });

  bench('ValidationError', () => {
    new ValidationError({
      message: 'invalid input',
      operation: 'validate',
    });
  });

  bench('KubeMQTimeoutError', () => {
    new KubeMQTimeoutError({
      message: 'timed out',
      operation: 'send',
    });
  });

  bench('KubeMQError with cause chain', () => {
    const cause = new Error('original');
    new KubeMQError({
      message: 'wrapped',
      operation: 'bench',
      cause,
      code: ErrorCode.Fatal,
    });
  });
});
