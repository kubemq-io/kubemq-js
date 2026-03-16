import { describe, it, expect, vi } from 'vitest';
import { noopLogger, createConsoleLogger } from '../../src/logger.js';
import { createTestLogger } from '../fixtures/test-helpers.js';

describe('noopLogger', () => {
  it('does not throw on any log level', () => {
    expect(() => noopLogger.debug('test')).not.toThrow();
    expect(() => noopLogger.info('test')).not.toThrow();
    expect(() => noopLogger.warn('test')).not.toThrow();
    expect(() => noopLogger.error('test')).not.toThrow();
  });

  it('accepts fields without error', () => {
    expect(() => noopLogger.debug('msg', { key: 'value' })).not.toThrow();
  });
});

describe('createConsoleLogger', () => {
  it('level=off returns a noop-like logger', () => {
    const logger = createConsoleLogger('off');
    expect(() => logger.debug('test')).not.toThrow();
    expect(() => logger.error('test')).not.toThrow();
  });

  it('level=error filters out debug, info, warn', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const logger = createConsoleLogger('error');
    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');

    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);

    debugSpy.mockRestore();
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('level=debug passes all levels through', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const logger = createConsoleLogger('debug');
    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');

    expect(debugSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);

    debugSpy.mockRestore();
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('includes fields in console output', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const logger = createConsoleLogger('info');
    logger.info('test message', { key: 'value' });

    expect(infoSpy).toHaveBeenCalledWith('[INFO] test message', { key: 'value' });

    infoSpy.mockRestore();
  });
});

describe('createTestLogger', () => {
  it('captures log entries', () => {
    const logger = createTestLogger();
    logger.debug('d-msg', { a: 1 });
    logger.info('i-msg');
    logger.warn('w-msg');
    logger.error('e-msg');

    expect(logger.entries).toHaveLength(4);
    expect(logger.entries[0]).toEqual({ level: 'debug', msg: 'd-msg', fields: { a: 1 } });
    expect(logger.entries[1]).toEqual({ level: 'info', msg: 'i-msg', fields: undefined });
    expect(logger.entries[2]).toEqual({ level: 'warn', msg: 'w-msg', fields: undefined });
    expect(logger.entries[3]).toEqual({ level: 'error', msg: 'e-msg', fields: undefined });
  });
});
