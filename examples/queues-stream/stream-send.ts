/**
 * Example: Stream Upstream (Send via Stream)
 *
 * Demonstrates sending messages through a persistent gRPC stream for
 * high-throughput queue ingestion. The stream avoids per-message
 * connection overhead.
 *
 * Prerequisites:
 *   - KubeMQ server running on localhost:50000
 *
 * Run: npx tsx examples/queues-stream/stream-send.ts
 */
import { KubeMQClient, createQueueMessage } from '../../src/index.js';

async function main(): Promise<void> {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-queues-stream-stream-send-client',
  });

  try {
    // Send multiple messages — the SDK reuses the underlying gRPC stream.
    for (let i = 1; i <= 10; i++) {
      await client.sendQueueMessage(
        createQueueMessage({
          channel: 'js-queues-stream.stream-send',
          body: `Sensor reading #${i}: temp=${(20 + Math.random() * 10).toFixed(1)}°C`,
          tags: { sensor: 'temp-01', batch: 'stream-demo' },
        }),
      );
    }

    console.log('Sent 10 messages via stream');
  } finally {
    await client.close();
  }
}

main().catch(console.error);
