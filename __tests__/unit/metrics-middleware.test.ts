import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MetricsMiddleware } from '../../src/internal/middleware/metrics.js';
import type { CardinalityConfig } from '../../src/internal/middleware/metrics.js';

function createMockLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe('MetricsMiddleware', () => {
  let logger: ReturnType<typeof createMockLogger>;
  let middleware: MetricsMiddleware;

  beforeEach(() => {
    logger = createMockLogger();
    middleware = new MetricsMiddleware(logger, '1.0.0-test');
  });

  it('isEnabled is false by default', () => {
    expect(middleware.isEnabled).toBe(false);
  });

  describe('record methods are no-op when disabled', () => {
    it('recordOperationDuration does not throw', () => {
      expect(() =>
        middleware.recordOperationDuration(0.5, { operationName: 'publish', channel: 'ch' }),
      ).not.toThrow();
    });

    it('recordMessageSent does not throw', () => {
      expect(() =>
        middleware.recordMessageSent({ operationName: 'publish', channel: 'ch' }),
      ).not.toThrow();
    });

    it('recordMessageConsumed does not throw', () => {
      expect(() =>
        middleware.recordMessageConsumed({ operationName: 'process', channel: 'ch' }),
      ).not.toThrow();
    });

    it('recordConnectionChange does not throw', () => {
      expect(() => middleware.recordConnectionChange(1)).not.toThrow();
    });

    it('recordReconnectionAttempt does not throw', () => {
      expect(() => middleware.recordReconnectionAttempt()).not.toThrow();
    });

    it('recordRetryAttempt does not throw', () => {
      expect(() => middleware.recordRetryAttempt({ operationName: 'publish' })).not.toThrow();
    });

    it('recordRetryExhausted does not throw', () => {
      expect(() => middleware.recordRetryExhausted({ operationName: 'publish' })).not.toThrow();
    });
  });

  describe('after lazyLoadApi', () => {
    beforeEach(async () => {
      await middleware.lazyLoadApi();
    });

    it('isEnabled is true', () => {
      expect(middleware.isEnabled).toBe(true);
    });

    it('lazyLoadApi is idempotent', async () => {
      const enabledBefore = middleware.isEnabled;
      await middleware.lazyLoadApi();
      expect(middleware.isEnabled).toBe(enabledBefore);
    });

    it('recordOperationDuration does not throw', () => {
      expect(() =>
        middleware.recordOperationDuration(0.123, { operationName: 'publish', channel: 'ch' }),
      ).not.toThrow();
    });

    it('recordMessageSent does not throw', () => {
      expect(() =>
        middleware.recordMessageSent({ operationName: 'publish', channel: 'ch' }, 3),
      ).not.toThrow();
    });

    it('recordMessageConsumed does not throw', () => {
      expect(() =>
        middleware.recordMessageConsumed({ operationName: 'process', channel: 'ch' }),
      ).not.toThrow();
    });

    it('recordConnectionChange does not throw', () => {
      expect(() => middleware.recordConnectionChange(1)).not.toThrow();
      expect(() => middleware.recordConnectionChange(-1)).not.toThrow();
    });

    it('recordReconnectionAttempt does not throw', () => {
      expect(() => middleware.recordReconnectionAttempt()).not.toThrow();
    });

    it('recordRetryAttempt does not throw', () => {
      expect(() =>
        middleware.recordRetryAttempt({ operationName: 'publish', errorType: 'transient' }),
      ).not.toThrow();
    });

    it('recordRetryExhausted does not throw', () => {
      expect(() =>
        middleware.recordRetryExhausted({ operationName: 'publish', errorType: 'timeout' }),
      ).not.toThrow();
    });
  });

  describe('shouldIncludeChannel cardinality', () => {
    it('allows channels within the max limit', () => {
      const cardConfig: CardinalityConfig = {
        maxChannelNames: 2,
        channelAllowlist: new Set(),
      };
      const mw = new MetricsMiddleware(logger, '1.0.0', cardConfig);

      mw.recordOperationDuration(0.1, { operationName: 'publish', channel: 'ch-1' });
      mw.recordOperationDuration(0.1, { operationName: 'publish', channel: 'ch-2' });
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('warns once when cardinality threshold is exceeded', async () => {
      const cardConfig: CardinalityConfig = {
        maxChannelNames: 2,
        channelAllowlist: new Set(),
      };
      const mw = new MetricsMiddleware(logger, '1.0.0', cardConfig);
      await mw.lazyLoadApi();

      mw.recordOperationDuration(0.1, { operationName: 'publish', channel: 'ch-1' });
      mw.recordOperationDuration(0.1, { operationName: 'publish', channel: 'ch-2' });
      mw.recordOperationDuration(0.1, { operationName: 'publish', channel: 'ch-3' });

      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('cardinality'),
        expect.objectContaining({ threshold: 2 }),
      );
    });

    it('warns only once even with many excess channels', async () => {
      const cardConfig: CardinalityConfig = {
        maxChannelNames: 2,
        channelAllowlist: new Set(),
      };
      const mw = new MetricsMiddleware(logger, '1.0.0', cardConfig);
      await mw.lazyLoadApi();

      mw.recordOperationDuration(0.1, { operationName: 'publish', channel: 'ch-1' });
      mw.recordOperationDuration(0.1, { operationName: 'publish', channel: 'ch-2' });
      mw.recordOperationDuration(0.1, { operationName: 'publish', channel: 'ch-3' });
      mw.recordOperationDuration(0.1, { operationName: 'publish', channel: 'ch-4' });
      mw.recordOperationDuration(0.1, { operationName: 'publish', channel: 'ch-5' });

      expect(logger.warn).toHaveBeenCalledTimes(1);
    });

    it('always includes allowlisted channels', async () => {
      const cardConfig: CardinalityConfig = {
        maxChannelNames: 1,
        channelAllowlist: new Set(['vip-channel']),
      };
      const mw = new MetricsMiddleware(logger, '1.0.0', cardConfig);
      await mw.lazyLoadApi();

      mw.recordOperationDuration(0.1, { operationName: 'publish', channel: 'ch-1' });
      mw.recordOperationDuration(0.1, { operationName: 'publish', channel: 'vip-channel' });

      expect(logger.warn).not.toHaveBeenCalled();
    });
  });
});
