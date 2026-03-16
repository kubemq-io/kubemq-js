import { KubeMQClient, createEventMessage } from '../../src/index.js';

async function main() {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-events-stream-send-client',
  });

  try {
    const stream = client.createEventStream();
    stream.onError((err) => {
      console.error('Stream error:', err.message);
    });

    for (let i = 1; i <= 5; i++) {
      stream.send(createEventMessage({ channel: 'js-events.stream-send', body: `event #${i}` }));
      console.log('Sent event', i);
    }

    await new Promise((r) => setTimeout(r, 500));
    stream.close();
    console.log('Stream closed');
  } finally {
    await client.close();
  }
}

main().catch(console.error);
