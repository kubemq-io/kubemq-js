/**
 * Example: Request-Reply Pattern
 *
 * Demonstrates the request-reply messaging pattern using KubeMQ commands
 * and queries. A responder subscribes to a channel, processes incoming
 * requests, and sends back responses.
 *
 * Prerequisites:
 *   - KubeMQ server running on localhost:50000
 *
 * Run: npx tsx examples/patterns/request-reply.ts
 */
import { KubeMQClient, createCommand, createQuery } from '../../src/index.js';

async function main(): Promise<void> {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-patterns-request-reply-client',
  });

  try {
    // --- Command-based request/reply (fire-and-confirm) ---
    console.log('=== Command Request/Reply ===');

    const cmdSub = client.subscribeToCommands({
      channel: 'js-patterns.request-reply-cmd',
      onCommand: async (cmd) => {
        const payload = JSON.parse(new TextDecoder().decode(cmd.body));
        console.log('Command handler received:', payload);

        await client.sendCommandResponse({
          id: cmd.id,
          replyChannel: cmd.replyChannel,
          executed: true,
        });
      },
      onError: (err) => {
        console.error('Command subscription error:', err.message);
      },
    });

    await new Promise((r) => setTimeout(r, 500));

    const cmdResponse = await client.sendCommand(
      createCommand({
        channel: 'js-patterns.request-reply-cmd',
        body: JSON.stringify({ action: 'restart', service: 'web-server' }),
        timeoutMs: 5000,
      }),
    );
    console.log('Command executed:', cmdResponse.executed);

    cmdSub.cancel();

    // --- Query-based request/reply (request with data response) ---
    console.log('\n=== Query Request/Reply ===');

    const querySub = client.subscribeToQueries({
      channel: 'js-patterns.request-reply-query',
      onQuery: async (query) => {
        const request = JSON.parse(new TextDecoder().decode(query.body));
        console.log('Query handler received:', request);

        const result = { userId: request.userId, name: 'Alice', role: 'admin' };

        await client.sendQueryResponse({
          id: query.id,
          replyChannel: query.replyChannel,
          executed: true,
          body: new TextEncoder().encode(JSON.stringify(result)),
        });
      },
      onError: (err) => {
        console.error('Query subscription error:', err.message);
      },
    });

    await new Promise((r) => setTimeout(r, 500));

    const queryResponse = await client.sendQuery(
      createQuery({
        channel: 'js-patterns.request-reply-query',
        body: JSON.stringify({ userId: 'u-1001' }),
        timeoutMs: 5000,
      }),
    );

    if (queryResponse.executed && queryResponse.body) {
      const data = JSON.parse(new TextDecoder().decode(queryResponse.body));
      console.log('Query response:', data);
    }

    querySub.cancel();
  } finally {
    await client.close();
  }
}

main().catch(console.error);
