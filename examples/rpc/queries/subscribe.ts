import { Config, Utils, QueriesClient } from '../../../src';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const opts: Config = {
  address: 'localhost:50000',
  clientId: Utils.uuid(),
  reconnectInterval: 5000,
};
const queriesClient = new QueriesClient(opts);

const testSubscribe = async () => {
  const serverClientId = Utils.uuid();
  const subscription = await queriesClient.subscribe(
    {
      channel: 'test.prpc.subscribe',
      clientId: serverClientId,
    },
    (err, msg) => {
      if (err) {
        console.log('Subscription error event:', err);
      } else {
        console.log('Subscription message event:', msg);
        return queriesClient.response({
          clientId: serverClientId,
          error: '',
          executed: true,
          id: msg.id,
          replyChannel: msg.replyChannel,
          timestamp: Date.now(),
          body: 'Hello from server',
        });
      }
    },
  );

  console.log('Subscription initialized');

  // Handle subscription state changes
  subscription.onState.on((event) => {
    console.log("Received '%s' event", event);
    if (event === 'disconnected') {
      console.log('Unsubscribed from channel');
    }
  });

  // Send a message to the channel
  await sleep(1000);
  await queriesClient
    .send({
      channel: 'test.prpc.subscribe',
      clientId: Utils.uuid(),
      body: 'Hello from client',
    })
    .catch((error) => console.error('Error sending message:', error));

  // Wait for 10 seconds before unsubscribing
  await sleep(10_000);
  console.log('Unsubscribing from channel');
  subscription.unsubscribe();
};

testSubscribe();
