import { KubeMQClient, createQueueMessage } from '../../src/index.js';

async function main() {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-queues-stream-nack-all-client',
  });

  try {
    await client.sendQueueMessage(
      createQueueMessage({ channel: 'js-queues-stream.nack-all', body: 'will be nacked' }),
    );

    const handle = client.streamQueueMessages({ channel: 'js-queues-stream.nack-all', maxMessages: 10 });
    handle.onMessages((msgs) => {
      console.log('Received', msgs.length, 'message(s) — nacking all');
      handle.nackAll();
      handle.close();
    });
    handle.onError((err) => {
      console.error('Error:', err.message);
    });

    await new Promise((r) => setTimeout(r, 2000));
  } finally {
    await client.close();
  }
}

main().catch(console.error);
