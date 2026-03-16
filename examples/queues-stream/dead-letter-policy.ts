/**
 * Example: Queue Stream — Dead-Letter Queue Policy
 *
 * Demonstrates the dead-letter queue (DLQ) pattern via the stream API.
 * A message is sent with maxReceiveCount=3 and maxReceiveQueue pointing
 * to a DLQ channel. When the message is rejected (nacked) more than
 * 3 times, it is automatically moved to the DLQ.
 *
 * Prerequisites:
 *   - KubeMQ server running on localhost:50000
 *
 * Run: npx tsx examples/queues-stream/dead-letter-policy.ts
 */
import { KubeMQClient, createQueueMessage } from '../../src/index.js';

async function main(): Promise<void> {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-queues-stream-dead-letter-policy-client',
  });

  try {
    const upstream = client.createQueueUpstream();

    await upstream.send([
      createQueueMessage({
        channel: 'js-queues-stream.dead-letter-policy',
        body: 'Flaky job that will fail',
        policy: {
          maxReceiveCount: 3,
          maxReceiveQueue: 'js-queues-stream.dead-letter-policy-dlq',
        },
      }),
    ]);

    console.log('Sent message with DLQ policy (maxReceiveCount=3)');

    for (let attempt = 1; attempt <= 4; attempt++) {
      const handle = client.streamQueueMessages({
        channel: 'js-queues-stream.dead-letter-policy',
        maxMessages: 1,
        waitTimeoutSeconds: 3,
      });

      await new Promise<void>((resolve) => {
        handle.onMessages((msgs) => {
          if (msgs.length === 0) {
            console.log(`Attempt ${attempt}: no messages (moved to DLQ)`);
          } else {
            const first = msgs[0]!;
            console.log(
              `Attempt ${attempt}: received "${new TextDecoder().decode(first.body)}" (receiveCount=${first.receiveCount}) — rejecting`,
            );
            handle.nackAll();
          }
          setTimeout(() => {
            handle.close();
            resolve();
          }, 500);
        });

        handle.onError(() => {
          handle.close();
          resolve();
        });
      });
    }

    console.log('\nChecking dead-letter queue...');
    const dlqHandle = client.streamQueueMessages({
      channel: 'js-queues-stream.dead-letter-policy-dlq',
      maxMessages: 10,
      waitTimeoutSeconds: 3,
      autoAck: true,
    });

    dlqHandle.onMessages((msgs) => {
      console.log(`DLQ contains ${msgs.length} message(s):`);
      for (const msg of msgs) {
        console.log(`  "${new TextDecoder().decode(msg.body)}" (receiveCount=${msg.receiveCount})`);
      }
    });

    dlqHandle.onError((err) => {
      console.error('DLQ error:', err.message);
    });

    await new Promise((resolve) => setTimeout(resolve, 3000));
    dlqHandle.close();
    upstream.close();
  } finally {
    await client.close();
  }
}

main().catch(console.error);
