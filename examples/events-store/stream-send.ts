import { KubeMQClient, createEventStoreMessage } from '../../src/index.js';

async function main() {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-events-store-stream-send-client',
  });

  try {
    const stream = client.createEventStoreStream();
    stream.onError((err) => {
      console.error('Stream error:', err.message);
    });

    for (let i = 1; i <= 5; i++) {
      await stream.send(
        createEventStoreMessage({
          channel: 'js-events-store.stream-send',
          body: `persisted #${i}`,
        }),
      );
      console.log('Persisted event', i);
    }

    stream.close();
    console.log('Event store stream closed');
  } finally {
    await client.close();
  }
}

main().catch(console.error);
