import { KubeMQClient, createQueueMessage } from '../../src/index.js';

async function main() {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-queues-stream-requeue-all-client',
  });

  try {
    await client.sendQueueMessage(
      createQueueMessage({ channel: 'js-queues-stream.requeue-all', body: 'will be requeued' }),
    );

    const handle = client.streamQueueMessages({
      channel: 'js-queues-stream.requeue-all',
      maxMessages: 10,
    });
    handle.onMessages((msgs) => {
      console.log(
        'Received',
        msgs.length,
        'message(s) — requeuing to js-queues-stream.requeue-all-target',
      );
      handle.reQueueAll('js-queues-stream.requeue-all-target');
      handle.close();
    });
    handle.onError((err) => {
      console.error('Error:', err.message);
    });

    await new Promise((r) => setTimeout(r, 2000));
    console.log(
      'Messages moved from js-queues-stream.requeue-all to js-queues-stream.requeue-all-target',
    );
  } finally {
    await client.close();
  }
}

main().catch(console.error);
