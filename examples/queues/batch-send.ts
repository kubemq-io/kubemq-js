/**
 * Example: Batch Message Sending
 *
 * Demonstrates sending multiple queue messages in a single batch operation.
 * The batch result reports which messages succeeded and which failed,
 * allowing partial failure handling.
 *
 * Prerequisites:
 *   - KubeMQ server running on localhost:50000
 *
 * Run: npx tsx examples/queues/batch-send.ts
 */
import { KubeMQClient, createQueueMessage } from '../../src/index.js';

async function main(): Promise<void> {
  const client = await KubeMQClient.create({ address: 'localhost:50000', clientId: 'js-queues-batch-send-client' });

  try {
    const messages = [
      createQueueMessage({ channel: 'js-queues.batch-send', body: 'Process image batch-001.zip' }),
      createQueueMessage({ channel: 'js-queues.batch-send', body: 'Process image batch-002.zip' }),
      createQueueMessage({ channel: 'js-queues.batch-send', body: 'Process image batch-003.zip' }),
      createQueueMessage({ channel: 'js-queues.batch-send', body: 'Process image batch-004.zip' }),
      createQueueMessage({ channel: 'js-queues.batch-send', body: 'Process image batch-005.zip' }),
    ];

    const result = await client.sendQueueMessagesBatch(messages);

    console.log(`Batch result: ${result.successCount} succeeded, ${result.failureCount} failed`);

    for (const r of result.results) {
      if (r.error) {
        console.error(`  Message #${r.index} failed:`, r.error.message);
      } else {
        console.log(`  Message #${r.index} sent:`, r.messageId);
      }
    }
  } finally {
    await client.close();
  }
}

main().catch(console.error);
