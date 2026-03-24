import { describe, it, expect, afterEach } from 'vitest';
import { KubeMQClient } from '../../src/client.js';
import { createTestClientOptions, uniqueChannel } from '../fixtures/test-helpers.js';
import type { CommandReceived, CommandResponse } from '../../src/messages/commands.js';
import type { QueryReceived, QueryResponse } from '../../src/messages/queries.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    if (typeof timer === 'object' && 'unref' in timer) timer.unref();
  });
}

describe('RPC Commands integration', () => {
  let client: KubeMQClient;

  afterEach(async () => {
    if (client) await client.close().catch(() => {});
  });

  it('sends command and receives response', async () => {
    client = await KubeMQClient.create(createTestClientOptions());
    const channel = uniqueChannel('cmd-ok');

    const sub = client.subscribeToCommands({
      channel,
      group: '',
      onCommand: (cmd: CommandReceived) => {
        client.sendCommandResponse({
          id: cmd.id,
          replyChannel: cmd.replyChannel,
          executed: true,
        });
      },
      onError: () => {},
    });
    await sleep(500);

    const response: CommandResponse = await client.sendCommand({
      channel,
      body: new TextEncoder().encode('do-something'),
      timeoutInSeconds: 10,
    });

    expect(response.executed).toBe(true);
    sub.cancel();
  });

  it('command times out when no subscriber', async () => {
    client = await KubeMQClient.create(createTestClientOptions());
    const channel = uniqueChannel('cmd-timeout');

    await expect(
      client.sendCommand({
        channel,
        body: new TextEncoder().encode('timeout-cmd'),
        timeoutInSeconds: 1,
      }),
    ).rejects.toThrow();
  });

  it('command subscriber can reject', async () => {
    client = await KubeMQClient.create(createTestClientOptions());
    const channel = uniqueChannel('cmd-reject');

    const sub = client.subscribeToCommands({
      channel,
      group: '',
      onCommand: (cmd: CommandReceived) => {
        client.sendCommandResponse({
          id: cmd.id,
          replyChannel: cmd.replyChannel,
          executed: false,
          error: 'rejected by handler',
        });
      },
      onError: () => {},
    });
    await sleep(500);

    const response: CommandResponse = await client.sendCommand({
      channel,
      body: new TextEncoder().encode('will-reject'),
      timeoutInSeconds: 10,
    });

    expect(response.executed).toBe(false);
    expect(response.error).toBe('rejected by handler');
    sub.cancel();
  });
});

describe('RPC Queries integration', () => {
  let client: KubeMQClient;

  afterEach(async () => {
    if (client) await client.close().catch(() => {});
  });

  it('sends query and receives response with body', async () => {
    client = await KubeMQClient.create(createTestClientOptions());
    const channel = uniqueChannel('qry-body');

    const sub = client.subscribeToQueries({
      channel,
      group: '',
      onQuery: (query: QueryReceived) => {
        client.sendQueryResponse({
          id: query.id,
          replyChannel: query.replyChannel,
          executed: true,
          body: new TextEncoder().encode('query-result'),
        });
      },
      onError: () => {},
    });
    await sleep(500);

    const response: QueryResponse = await client.sendQuery({
      channel,
      body: new TextEncoder().encode('ask-something'),
      timeoutInSeconds: 10,
    });

    expect(response.executed).toBe(true);
    expect(response.body).toBeDefined();
    expect(new TextDecoder().decode(response.body!)).toBe('query-result');
    sub.cancel();
  });

  it('query times out when no subscriber', async () => {
    client = await KubeMQClient.create(createTestClientOptions());
    const channel = uniqueChannel('qry-timeout');

    await expect(
      client.sendQuery({
        channel,
        body: new TextEncoder().encode('timeout-query'),
        timeoutInSeconds: 1,
      }),
    ).rejects.toThrow();
  });

  it('query subscriber can return metadata', async () => {
    client = await KubeMQClient.create(createTestClientOptions());
    const channel = uniqueChannel('qry-meta');

    const sub = client.subscribeToQueries({
      channel,
      group: '',
      onQuery: (query: QueryReceived) => {
        client.sendQueryResponse({
          id: query.id,
          replyChannel: query.replyChannel,
          executed: true,
          metadata: 'response-metadata',
          body: new TextEncoder().encode('with-meta'),
        });
      },
      onError: () => {},
    });
    await sleep(500);

    const response: QueryResponse = await client.sendQuery({
      channel,
      body: new TextEncoder().encode('ask-meta'),
      timeoutInSeconds: 10,
    });

    expect(response.executed).toBe(true);
    expect(response.metadata).toBe('response-metadata');
    sub.cancel();
  });
});
