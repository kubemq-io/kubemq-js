import { describe, it, expect } from 'vitest';
import {
  validateEventMessage,
  validateEventStoreMessage,
  validateQueueMessage,
  validateCommandMessage,
  validateQueryMessage,
  validateQueuePollRequest,
  validateSubscription,
  validateEventStoreSubscription,
  validateResponseMessage,
} from '../../src/internal/validation/message-validator.js';
import { EventStoreType } from '../../src/messages/events-store.js';
import { ValidationError } from '../../src/errors.js';

describe('validateEventMessage', () => {
  it('passes with valid channel and body', () => {
    expect(() =>
      validateEventMessage({ channel: 'my-events', body: new Uint8Array([1]) }, 'test'),
    ).not.toThrow();
  });

  it('throws on empty channel', () => {
    expect(() => validateEventMessage({ channel: '' }, 'test')).toThrow(ValidationError);
  });

  it('throws on whitespace-only channel', () => {
    expect(() => validateEventMessage({ channel: '   ' }, 'test')).toThrow(ValidationError);
  });
});

describe('validateEventStoreMessage', () => {
  it('passes with valid channel and body', () => {
    expect(() =>
      validateEventStoreMessage({ channel: 'es-channel', body: new Uint8Array([1]) }, 'test'),
    ).not.toThrow();
  });

  it('throws on empty channel', () => {
    expect(() => validateEventStoreMessage({ channel: '' }, 'test')).toThrow(ValidationError);
  });
});

describe('validateQueueMessage', () => {
  it('passes with valid channel and body', () => {
    expect(() =>
      validateQueueMessage({ channel: 'q-channel', body: new Uint8Array([1]) }, 'test'),
    ).not.toThrow();
  });

  it('throws on empty channel', () => {
    expect(() => validateQueueMessage({ channel: '' }, 'test')).toThrow(ValidationError);
  });

  it('throws on negative delaySeconds', () => {
    expect(() =>
      validateQueueMessage({ channel: 'q-channel', policy: { delaySeconds: -1 } }, 'test'),
    ).toThrow(ValidationError);
  });

  it('throws on maxReceiveCount without maxReceiveQueue', () => {
    expect(() =>
      validateQueueMessage({ channel: 'q-channel', policy: { maxReceiveCount: 3 } }, 'test'),
    ).toThrow(ValidationError);
  });

  it('passes with maxReceiveCount and maxReceiveQueue', () => {
    expect(() =>
      validateQueueMessage(
        {
          channel: 'q-channel',
          body: new Uint8Array([1]),
          policy: { maxReceiveCount: 3, maxReceiveQueue: 'dlq' },
        },
        'test',
      ),
    ).not.toThrow();
  });
});

describe('validateCommandMessage', () => {
  it('passes with valid body and timeout', () => {
    expect(() =>
      validateCommandMessage({ channel: 'cmd-channel', body: 'hello', timeoutMs: 5000 }, 'test'),
    ).not.toThrow();
  });

  it('passes with metadata instead of body', () => {
    expect(() =>
      validateCommandMessage({ channel: 'cmd-channel', metadata: 'meta', timeoutMs: 5000 }, 'test'),
    ).not.toThrow();
  });

  it('passes with tags instead of body', () => {
    expect(() =>
      validateCommandMessage(
        { channel: 'cmd-channel', tags: { key: 'value' }, timeoutMs: 5000 },
        'test',
      ),
    ).not.toThrow();
  });

  it('throws on empty channel', () => {
    expect(() =>
      validateCommandMessage({ channel: '', body: 'hello', timeoutMs: 5000 }, 'test'),
    ).toThrow(ValidationError);
  });

  it('throws on missing body, metadata, and tags', () => {
    expect(() =>
      validateCommandMessage({ channel: 'cmd-channel', timeoutMs: 5000 }, 'test'),
    ).toThrow(ValidationError);
  });

  it('throws on zero timeoutMs', () => {
    expect(() =>
      validateCommandMessage({ channel: 'cmd-channel', body: 'hello', timeoutMs: 0 }, 'test'),
    ).toThrow(ValidationError);
  });

  it('throws on negative timeoutMs', () => {
    expect(() =>
      validateCommandMessage({ channel: 'cmd-channel', body: 'hello', timeoutMs: -100 }, 'test'),
    ).toThrow(ValidationError);
  });
});

describe('validateQueryMessage', () => {
  it('passes with valid body and timeout', () => {
    expect(() =>
      validateQueryMessage({ channel: 'query-channel', body: 'data', timeoutMs: 5000 }, 'test'),
    ).not.toThrow();
  });

  it('throws on empty channel', () => {
    expect(() =>
      validateQueryMessage({ channel: '', body: 'data', timeoutMs: 5000 }, 'test'),
    ).toThrow(ValidationError);
  });

  it('throws on missing content (no body, metadata, or tags)', () => {
    expect(() =>
      validateQueryMessage({ channel: 'query-channel', timeoutMs: 5000 }, 'test'),
    ).toThrow(ValidationError);
  });

  it('throws on zero timeoutMs', () => {
    expect(() =>
      validateQueryMessage({ channel: 'query-channel', body: 'data', timeoutMs: 0 }, 'test'),
    ).toThrow(ValidationError);
  });

  it('throws on negative cacheTTL', () => {
    expect(() =>
      validateQueryMessage(
        { channel: 'query-channel', body: 'data', timeoutMs: 5000, cacheTTL: -1 },
        'test',
      ),
    ).toThrow(ValidationError);
  });

  it('passes with valid cacheTTL', () => {
    expect(() =>
      validateQueryMessage(
        { channel: 'query-channel', body: 'data', timeoutMs: 5000, cacheTTL: 60 },
        'test',
      ),
    ).not.toThrow();
  });
});

describe('validateQueuePollRequest', () => {
  it('passes with valid request', () => {
    expect(() =>
      validateQueuePollRequest(
        { channel: 'poll-channel', waitTimeoutSeconds: 10, visibilitySeconds: 30 },
        'test',
      ),
    ).not.toThrow();
  });

  it('throws on empty channel', () => {
    expect(() =>
      validateQueuePollRequest(
        { channel: '', waitTimeoutSeconds: 10, visibilitySeconds: 30 },
        'test',
      ),
    ).toThrow(ValidationError);
  });

  it('throws on zero waitTimeoutSeconds', () => {
    expect(() =>
      validateQueuePollRequest(
        { channel: 'poll-channel', waitTimeoutSeconds: 0, visibilitySeconds: 30 },
        'test',
      ),
    ).toThrow(ValidationError);
  });

  it('throws on negative visibilitySeconds', () => {
    expect(() =>
      validateQueuePollRequest(
        { channel: 'poll-channel', waitTimeoutSeconds: 10, visibilitySeconds: -5 },
        'test',
      ),
    ).toThrow(ValidationError);
  });

  it('throws on autoAck with visibilitySeconds together', () => {
    expect(() =>
      validateQueuePollRequest(
        { channel: 'poll-channel', waitTimeoutSeconds: 10, visibilitySeconds: 30, autoAck: true },
        'test',
      ),
    ).toThrow(ValidationError);
  });

  it('passes with autoAck and zero visibilitySeconds', () => {
    expect(() =>
      validateQueuePollRequest(
        { channel: 'poll-channel', waitTimeoutSeconds: 10, visibilitySeconds: 0, autoAck: true },
        'test',
      ),
    ).not.toThrow();
  });
});

describe('validateSubscription', () => {
  it('passes with valid channel', () => {
    expect(() => validateSubscription({ channel: 'sub-channel' }, 'test')).not.toThrow();
  });

  it('throws on empty channel', () => {
    expect(() => validateSubscription({ channel: '' }, 'test')).toThrow(ValidationError);
  });
});

describe('validateEventStoreSubscription', () => {
  const noop = () => {};

  it('passes with StartNewOnly', () => {
    expect(() =>
      validateEventStoreSubscription(
        {
          channel: 'es-channel',
          startFrom: EventStoreType.StartNewOnly,
          onMessage: noop,
          onError: noop,
        },
        'test',
      ),
    ).not.toThrow();
  });

  it('passes with StartFromFirst', () => {
    expect(() =>
      validateEventStoreSubscription(
        {
          channel: 'es-channel',
          startFrom: EventStoreType.StartFromFirst,
          onMessage: noop,
          onError: noop,
        },
        'test',
      ),
    ).not.toThrow();
  });

  it('throws on empty channel', () => {
    expect(() =>
      validateEventStoreSubscription(
        { channel: '', startFrom: EventStoreType.StartNewOnly, onMessage: noop, onError: noop },
        'test',
      ),
    ).toThrow(ValidationError);
  });

  it('throws on missing startFrom', () => {
    expect(() =>
      validateEventStoreSubscription(
        { channel: 'es-channel', onMessage: noop, onError: noop } as any,
        'test',
      ),
    ).toThrow(ValidationError);
  });

  it('throws on StartAtSequence with negative startValue', () => {
    expect(() =>
      validateEventStoreSubscription(
        {
          channel: 'es-channel',
          startFrom: EventStoreType.StartAtSequence,
          startValue: -1,
          onMessage: noop,
          onError: noop,
        },
        'test',
      ),
    ).toThrow(ValidationError);
  });

  it('throws on StartAtSequence with zero startValue (must be > 0)', () => {
    expect(() =>
      validateEventStoreSubscription(
        {
          channel: 'es-channel',
          startFrom: EventStoreType.StartAtSequence,
          startValue: 0,
          onMessage: noop,
          onError: noop,
        },
        'test',
      ),
    ).toThrow(ValidationError);
  });

  it('throws on StartAtTime with zero startValue', () => {
    expect(() =>
      validateEventStoreSubscription(
        {
          channel: 'es-channel',
          startFrom: EventStoreType.StartAtTime,
          startValue: 0,
          onMessage: noop,
          onError: noop,
        },
        'test',
      ),
    ).toThrow(ValidationError);
  });

  it('passes on StartAtTime with positive startValue', () => {
    expect(() =>
      validateEventStoreSubscription(
        {
          channel: 'es-channel',
          startFrom: EventStoreType.StartAtTime,
          startValue: 1700000000,
          onMessage: noop,
          onError: noop,
        },
        'test',
      ),
    ).not.toThrow();
  });

  it('throws on StartAtTimeDelta with zero startValue', () => {
    expect(() =>
      validateEventStoreSubscription(
        {
          channel: 'es-channel',
          startFrom: EventStoreType.StartAtTimeDelta,
          startValue: 0,
          onMessage: noop,
          onError: noop,
        },
        'test',
      ),
    ).toThrow(ValidationError);
  });

  it('passes on StartAtTimeDelta with positive startValue', () => {
    expect(() =>
      validateEventStoreSubscription(
        {
          channel: 'es-channel',
          startFrom: EventStoreType.StartAtTimeDelta,
          startValue: 60,
          onMessage: noop,
          onError: noop,
        },
        'test',
      ),
    ).not.toThrow();
  });
});

describe('channel format validation (GAP-09)', () => {
  it('rejects wildcards in event message channel', () => {
    expect(() =>
      validateEventMessage({ channel: 'events.*', body: new Uint8Array([1]) } as any, 'test'),
    ).toThrow(/wildcard/i);
  });

  it('rejects wildcards in queue message channel', () => {
    expect(() =>
      validateQueueMessage({ channel: 'q.>', body: new Uint8Array([1]) } as any, 'test'),
    ).toThrow(/wildcard/i);
  });

  it('rejects whitespace in channel name', () => {
    expect(() =>
      validateEventMessage({ channel: 'events test', body: new Uint8Array([1]) } as any, 'test'),
    ).toThrow(/whitespace/i);
  });

  it('rejects trailing dot in channel name', () => {
    expect(() =>
      validateEventMessage({ channel: 'events.', body: new Uint8Array([1]) } as any, 'test'),
    ).toThrow(/end with/i);
  });

  it('allows wildcards in Events subscribe channel (allowWildcards=true)', () => {
    expect(() =>
      validateSubscription({ channel: 'events.*', group: '' }, 'test', true),
    ).not.toThrow();
    expect(() =>
      validateSubscription({ channel: 'events.>', group: '' }, 'test', true),
    ).not.toThrow();
  });

  it('rejects wildcards in Commands subscribe channel (default allowWildcards=false)', () => {
    expect(() => validateSubscription({ channel: 'commands.*' }, 'subscribeToCommands')).toThrow(
      /wildcard/i,
    );
    expect(() => validateSubscription({ channel: 'commands.>' }, 'subscribeToCommands')).toThrow(
      /wildcard/i,
    );
  });

  it('rejects wildcards in Queries subscribe channel (default allowWildcards=false)', () => {
    expect(() => validateSubscription({ channel: 'queries.*' }, 'subscribeToQueries')).toThrow(
      /wildcard/i,
    );
    expect(() => validateSubscription({ channel: 'queries.>' }, 'subscribeToQueries')).toThrow(
      /wildcard/i,
    );
  });
});

describe('cacheKey/cacheTTL coupling (GAP-10)', () => {
  it('rejects cacheKey without cacheTTL', () => {
    expect(() =>
      validateQueryMessage(
        {
          channel: 'q-ch',
          body: new Uint8Array([1]),
          timeoutMs: 5000,
          cacheKey: 'my-key',
        } as any,
        'test',
      ),
    ).toThrow(/cacheTTL/i);
  });

  it('allows cacheKey with positive cacheTTL', () => {
    expect(() =>
      validateQueryMessage(
        {
          channel: 'q-ch',
          body: new Uint8Array([1]),
          timeoutMs: 5000,
          cacheKey: 'my-key',
          cacheTTL: 60,
        } as any,
        'test',
      ),
    ).not.toThrow();
  });
});

describe('validateResponseMessage (GAP-11)', () => {
  it('rejects empty id', () => {
    expect(() => validateResponseMessage({ id: '', replyChannel: 'reply' }, 'test')).toThrow(/id/i);
  });

  it('rejects empty replyChannel', () => {
    expect(() => validateResponseMessage({ id: 'req-1', replyChannel: '' }, 'test')).toThrow(
      /replyChannel/i,
    );
  });

  it('passes with valid id and replyChannel', () => {
    expect(() =>
      validateResponseMessage({ id: 'req-1', replyChannel: 'reply' }, 'test'),
    ).not.toThrow();
  });
});

describe('body-or-metadata validation (GAP-12)', () => {
  it('rejects event with no body, metadata, or tags', () => {
    expect(() => validateEventMessage({ channel: 'ch' } as any, 'test')).toThrow();
  });

  it('rejects queue message with no body, metadata, or tags', () => {
    expect(() => validateQueueMessage({ channel: 'ch' } as any, 'test')).toThrow();
  });

  it('passes event with body', () => {
    expect(() =>
      validateEventMessage({ channel: 'ch', body: new Uint8Array([1]) } as any, 'test'),
    ).not.toThrow();
  });
});

describe('EventsStore wildcard rejection (GAP-15)', () => {
  it('rejects wildcard channel in EventsStore subscription', () => {
    expect(() =>
      validateEventStoreSubscription(
        {
          channel: 'events.*',
          startFrom: EventStoreType.StartNewOnly,
          onMessage: () => {},
          onError: () => {},
        } as any,
        'test',
      ),
    ).toThrow(/wildcard/i);
  });
});

describe('queue upper bound checks (GAP-18)', () => {
  it('rejects maxMessages > 1024', () => {
    expect(() =>
      validateQueuePollRequest(
        {
          channel: 'q',
          visibilitySeconds: 30,
          waitTimeoutSeconds: 5,
          maxMessages: 2000,
        },
        'test',
      ),
    ).toThrow(/1024/);
  });

  it('rejects waitTimeoutSeconds > 3600', () => {
    expect(() =>
      validateQueuePollRequest(
        {
          channel: 'q',
          visibilitySeconds: 30,
          waitTimeoutSeconds: 5000,
        },
        'test',
      ),
    ).toThrow(/3600/);
  });
});

describe('StartAtSequence validation (GAP-19)', () => {
  it('rejects sequence value 0', () => {
    expect(() =>
      validateEventStoreSubscription(
        {
          channel: 'store-ch',
          startFrom: EventStoreType.StartAtSequence,
          startValue: 0,
          onMessage: () => {},
          onError: () => {},
        } as any,
        'test',
      ),
    ).toThrow();
  });

  it('accepts sequence value 1', () => {
    expect(() =>
      validateEventStoreSubscription(
        {
          channel: 'store-ch',
          startFrom: EventStoreType.StartAtSequence,
          startValue: 1,
          onMessage: () => {},
          onError: () => {},
        } as any,
        'test',
      ),
    ).not.toThrow();
  });
});
