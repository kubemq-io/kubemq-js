import { KubeMQClient, createEventMessage } from '../../src/index.js';

async function main() {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-events-cancel-subscription-client',
  });

  try {
    let received = 0;
    const sub = client.subscribeToEvents({
      channel: 'js-events.cancel-subscription',
      onEvent: (event) => {
        received++;
        console.log(`Received #${received}:`, new TextDecoder().decode(event.body));
        if (received >= 3) sub.cancel();
      },
      onError: (err) => {
        console.error('Error:', err.message);
      },
    });

    for (let i = 1; i <= 5; i++) {
      await client.sendEvent(
        createEventMessage({ channel: 'js-events.cancel-subscription', body: `msg-${i}` }),
      );
    }

    await new Promise((r) => setTimeout(r, 1000));
    console.log('Total received before cancel:', received);
  } finally {
    await client.close();
  }
}

main().catch(console.error);
