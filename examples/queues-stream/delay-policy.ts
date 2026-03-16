/**
 * Example: Queue Stream — Delayed Message Delivery
 *
 * Demonstrates sending messages with a delay policy via the stream
 * upstream API. Messages are not delivered to consumers until the
 * specified delay has elapsed.
 *
 * Prerequisites:
 *   - KubeMQ server running on localhost:50000
 *
 * Run: npx tsx examples/queues-stream/delay-policy.ts
 */
import { KubeMQClient, createQueueMessage } from '../../src/index.js';

async function main(): Promise<void> {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-queues-stream-delay-policy-client',
  });

  try {
    const upstream = client.createQueueUpstream();

    const result = await upstream.send([
      createQueueMessage({
        channel: 'js-queues-stream.delay-policy',
        body: 'Order #1 — deliver after 5 seconds',
        policy: { delaySeconds: 5 },
      }),
      createQueueMessage({
        channel: 'js-queues-stream.delay-policy',
        body: 'Order #2 — deliver after 10 seconds',
        policy: { delaySeconds: 10 },
      }),
    ]);

    console.log('Sent', result.results.length, 'delayed messages');
    for (const r of result.results) {
      const delayed = r.delayedTo instanceof Date && !isNaN(r.delayedTo.getTime())
        ? r.delayedTo.toISOString()
        : 'N/A';
      console.log(`  ${r.messageId}: delayedTo=${delayed}`);
    }

    console.log('Waiting 6 seconds for first message to become available...');
    await new Promise((resolve) => setTimeout(resolve, 6000));

    const handle = client.streamQueueMessages({
      channel: 'js-queues-stream.delay-policy',
      maxMessages: 10,
      waitTimeoutSeconds: 3,
    });

    handle.onMessages((msgs) => {
      console.log(`Received ${msgs.length} message(s):`);
      for (const msg of msgs) {
        console.log(`  ${new TextDecoder().decode(msg.body)}`);
        msg.ack();
      }
    });

    handle.onError((err) => {
      console.error('Downstream error:', err.message);
    });

    await new Promise((resolve) => setTimeout(resolve, 5000));
    handle.close();
    upstream.close();
  } finally {
    await client.close();
  }
}

main().catch(console.error);
