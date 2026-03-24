import { KubeMQClient, createQueueMessage } from '../../src/index.js';

async function main() {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-queues-stream-ack-range-client',
  });

  try {
    for (let i = 0; i < 3; i++) {
      await client.sendQueueMessage(
        createQueueMessage({ channel: 'js-queues-stream.ack-range', body: `msg-${i}` }),
      );
    }

    const handle = client.streamQueueMessages({
      channel: 'js-queues-stream.ack-range',
      maxMessages: 3,
    });
    handle.onMessages((msgs) => {
      const sequences = msgs.map((m) => m.sequence);
      console.log('Received sequences:', sequences);
      handle.ackRange(sequences);
      console.log('Acknowledged range:', sequences);
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
