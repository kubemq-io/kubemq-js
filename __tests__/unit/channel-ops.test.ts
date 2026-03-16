import { describe, it, expect } from 'vitest';
import { channelTypeToString } from '../../src/internal/protocol/channel-ops.js';
import type { ChannelType } from '../../src/internal/protocol/channel-ops.js';

describe('channelTypeToString', () => {
  const cases: [ChannelType, string][] = [
    ['events', 'events'],
    ['events_store', 'events_store'],
    ['commands', 'commands'],
    ['queries', 'queries'],
    ['queues', 'queues'],
  ];

  it.each(cases)('maps "%s" → "%s"', (input, expected) => {
    expect(channelTypeToString(input)).toBe(expected);
  });
});
