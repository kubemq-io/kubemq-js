import { Config, PubsubClient, EventStoreType, Utils } from '../../src';

async function main() {
  const opts: Config = {
    address: 'localhost:50000',
    clientId: Utils.uuid(),
  };
  const pubsubClient = new PubsubClient(opts);

  //Subscribes to events store messages from the specified channel with a specific configuration.
  await pubsubClient
    .subscribeToEventsStore(
      {
        channel: 'events_store.A',
        group: 'g1',
        clientId: 'SubscriberA',
        requestType: EventStoreType.StartFromFirst,
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
    await pubsubClient.sendEventStoreMessage({
      channel: 'events_store.A',
      body: Utils.stringToBytes('event message'),
    });
  }
}
main();
