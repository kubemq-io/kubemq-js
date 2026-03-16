import { KubeMQClient, createQueueMessage } from '../../src/index.js';

async function main() {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-queues-stream-auto-ack-client',
  });

  try {
    for (let i = 1; i <= 3; i++) {
      await client.sendQueueMessage(
        createQueueMessage({ channel: 'js-queues-stream.auto-ack', body: `auto-${i}` }),
      );
    }

    const handle = client.streamQueueMessages({
      channel: 'js-queues-stream.auto-ack',
      autoAck: true,
      maxMessages: 3,
    });
    handle.onMessages((msgs) => {
      for (const m of msgs) {
        console.log('Auto-acked:', new TextDecoder().decode(m.body));
      }
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
