import { randomUUID } from 'node:crypto';

export function buildEventMessage(overrides?: Record<string, unknown>) {
  return {
    channel: `test-events-${randomUUID().slice(0, 8)}`,
    body: new TextEncoder().encode('test-body'),
    metadata: 'test-metadata',
    tags: { key1: 'value1' },
    ...overrides,
  };
}

export function buildEventStoreMessage(overrides?: Record<string, unknown>) {
  return {
    channel: `test-events-store-${randomUUID().slice(0, 8)}`,
    body: new TextEncoder().encode('test-body'),
    metadata: 'test-metadata',
    tags: { key1: 'value1' },
    ...overrides,
  };
}

export function buildQueueMessage(overrides?: Record<string, unknown>) {
  return {
    channel: `test-queue-${randomUUID().slice(0, 8)}`,
    body: new TextEncoder().encode('test-queue-body'),
    metadata: 'queue-metadata',
    tags: { priority: 'high' },
    ...overrides,
  };
}

export function buildCommandMessage(overrides?: Record<string, unknown>) {
  return {
    channel: `test-command-${randomUUID().slice(0, 8)}`,
    body: new TextEncoder().encode('test-command'),
    metadata: 'command-metadata',
    timeout: 5000,
    ...overrides,
  };
}

export function buildQueryMessage(overrides?: Record<string, unknown>) {
  return {
    channel: `test-query-${randomUUID().slice(0, 8)}`,
    body: new TextEncoder().encode('test-query'),
    metadata: 'query-metadata',
    timeout: 5000,
    ...overrides,
  };
}

export function buildCommandResponse(overrides?: Record<string, unknown>) {
  return {
    requestId: randomUUID(),
    clientId: 'test-responder',
    executed: true,
    ...overrides,
  };
}

export function buildQueryResponse(overrides?: Record<string, unknown>) {
  return {
    requestId: randomUUID(),
    clientId: 'test-responder',
    executed: true,
    body: new TextEncoder().encode('query-result'),
    metadata: 'response-metadata',
    ...overrides,
  };
}
