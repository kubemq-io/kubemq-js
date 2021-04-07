import { Config, EventsStoreClient, EventStoreType, Utils } from '../../../src';

async function main() {
  const opts: Config = {
    address: 'localhost:50000',
    clientId: Utils.uuid(),
  };
  const eventsStoreClient = new EventsStoreClient(opts);
  await eventsStoreClient
    .subscribe(
      {
        channel: 'events_store.loadbalance',
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

  await eventsStoreClient
    .subscribe(
      {
        channel: 'events_store.loadbalance',
        group: 'g1',
        clientId: 'SubscriberB',
        requestType: EventStoreType.StartFromFirst,
      },
      (err, msg) => {
        if (err) {
          console.error('SubscriberB', err);
          return;
        }
        if (msg) {
          console.log('SubscriberB', msg);
        }
      },
    )
    .catch((reason) => {
      console.log(reason);
    });

  await new Promise((r) => setTimeout(r, 2000));

  for (let i = 0; i < 10; i++) {
    await eventsStoreClient.send({
      channel: 'events_store.loadbalance',
      body: Utils.stringToBytes('event message'),
    });
  }
}
main();
