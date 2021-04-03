import { Config, EventsStoreClient, EventStoreType } from '../../../src';

function main() {
  const opts: Config = {
    address: 'localhost:50000',
    clientId: 'clientA',
  };
  const eventsStoreClient = new EventsStoreClient(opts);

  const subscriberA = eventsStoreClient.subscribe({
    channel: 'events_store.A',
    clientId: 'clientA',
    requestType: EventStoreType.StartFromFirst,
  });
  subscriberA.onEvent.on((event) => console.log('SubscriberA', event));
  subscriberA.onError.on((error) => console.error('SubscriberA', error));
  subscriberA.onStateChanged.on((state) => console.log('SubscriberA', state));

  const subscriberB = eventsStoreClient.subscribe({
    channel: 'events_store.B',
    clientId: 'clientB',
    requestType: EventStoreType.StartFromFirst,
  });
  subscriberB.onEvent.on((event) => console.log('SubscriberB', event));
  subscriberB.onError.on((error) => console.error('SubscriberB', error));
  subscriberB.onStateChanged.on((state) => console.log('SubscriberB', state));

  setTimeout(() => {
    for (let i = 0; i < 20; i++) {
      eventsStoreClient
        .send({ channel: 'events_store.A;events_store.B', body: 'data' })
        .catch((reason) => console.error(reason));
    }
  }, 2000);

  setTimeout(() => {
    eventsStoreClient.close();
  }, 4000);
}

main();
