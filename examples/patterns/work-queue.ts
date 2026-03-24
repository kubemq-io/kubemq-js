/**
 * Example: Work Queue (Competing Consumers) Pattern
 *
 * Demonstrates the competing consumers pattern where multiple workers
 * pull from the same queue, but each message is delivered to exactly one
 * worker. This enables horizontal scaling of message processing.
 *
 * Prerequisites:
 *   - KubeMQ server running on localhost:50000
 *
 * Run: npx tsx examples/patterns/work-queue.ts
 */
import { KubeMQClient, createQueueMessage } from '../../src/index.js';

async function main(): Promise<void> {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-patterns-work-queue-client',
  });

  try {
    const channel = 'js-patterns.work-queue';

    // Enqueue several tasks.
    const tasks = [
      'resize-image-001.jpg',
      'resize-image-002.jpg',
      'resize-image-003.jpg',
      'resize-image-004.jpg',
      'resize-image-005.jpg',
      'resize-image-006.jpg',
    ];

    for (const task of tasks) {
      await client.sendQueueMessage(
        createQueueMessage({
          channel,
          body: task,
          tags: { type: 'image-resize' },
        }),
      );
    }
    console.log(`Enqueued ${tasks.length} tasks\n`);

    // Simulate two competing workers pulling from the same queue.
    // Each worker receives different messages — no duplication.
    async function runWorker(name: string, count: number): Promise<void> {
      const messages = await client.receiveQueueMessages({
        channel,
        maxMessages: count,
        waitTimeoutSeconds: 5,
      });

      for (const msg of messages) {
        const body = new TextDecoder().decode(msg.body);
        console.log(`[${name}] Processing: ${body}`);
        // Simulate processing time.
        await new Promise((r) => setTimeout(r, 100));
        await msg.ack();
        console.log(`[${name}] Completed: ${body}`);
      }

      console.log(`[${name}] Finished — processed ${messages.length} tasks`);
    }

    // Both workers pull concurrently — each message goes to exactly one worker.
    await Promise.all([runWorker('Worker-A', 3), runWorker('Worker-B', 3)]);

    console.log('\nAll tasks processed by competing consumers');
  } finally {
    await client.close();
  }
}

main().catch(console.error);
