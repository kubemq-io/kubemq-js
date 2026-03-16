import { KubeMQClient, createQueueMessage } from '../../src/index.js';

async function main() {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-queues-stream-poll-mode-client',
  });

  try {
    await client.sendQueueMessage(createQueueMessage({ channel: 'js-queues-stream.poll-mode', body: 'poll-me' }));

    const messages = await client.receiveQueueMessages({
      channel: 'js-queues-stream.poll-mode',
      maxMessages: 1,
      visibilitySeconds: 10,
      waitTimeoutSeconds: 5,
    });

    for (const msg of messages) {
      console.log('Polled:', new TextDecoder().decode(msg.body));
    }
    console.log('Total polled:', messages.length);
  } finally {
    await client.close();
  }
}

main().catch(console.error);
