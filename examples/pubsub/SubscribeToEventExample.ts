import { PubsubClient, Utils, Config, EventStoreType } from '../../src';

async function main() {
  const opts: Config = {
    address: 'localhost:50000',
    clientId: Utils.uuid(),
  };
  const pubsubClient = new PubsubClient(opts);

  //Subscribes to events from the specified channel and processes received events.
  await pubsubClient
    .subscribeToEvents(
      {
        channel: 'events.A',
        clientId: 'SubscriberA',
      },
      (err, msg) => {
        if (err) {
          console.error('SubscriberA', err);
          return;
        }
        if (msg) {
          console.log('SubscriberA', msg);
        }
      },
    )
    .catch((reason) => {
      console.log(reason);
    });
    

  await new Promise((r) => setTimeout(r, 2000));

  for (let i = 0; i < 10; i++) {
    await pubsubClient.sendEventsMessage({
      channel: 'events.A',
      body: Utils.stringToBytes('event message'),
    });
  }
}
main();
