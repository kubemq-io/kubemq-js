import { Config, EventsStoreClient, EventStoreType, Utils } from '../../../src';

function main() {
  const opts: Config = {
    address: 'localhost:50000',
    clientId: Utils.uuid(),
  };
  const eventsStoreClient = new EventsStoreClient(opts);
  const subscriber = eventsStoreClient.subscribe({
    channel: 'events_store.single',
    requestType: EventStoreType.StartFromFirst,
  });
  subscriber.onEvent.on((event) => console.log(event));
  subscriber.onError.on((error) => console.error(error));
  subscriber.onStateChanged.on((state) => console.log(state));

  setTimeout(() => {
    for (let i = 0; i < 20; i++) {
      eventsStoreClient
        .send({ channel: 'events_store.single', body: Utils.stringToBytes('data') })
        .catch((reason) => console.error(reason));
    }
  }, 2000);

  setTimeout(() => {
    eventsStoreClient.close();
  }, 4000);
}

main();
