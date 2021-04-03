import { Config, EventsStoreClient, EventStoreType, Utils } from '../../../src';

function main() {
  const opts: Config = {
    address: 'localhost:50000',
    clientId: Utils.uuid(),
  };
  const eventsStoreClient = new EventsStoreClient(opts);
  const subscriber = eventsStoreClient.subscribe({
    channel: 'events_store.stream',
    requestType: EventStoreType.StartFromFirst,
  });
  subscriber.onEvent.on((event) => console.log(event));
  subscriber.onError.on((error) => console.error(error));
  subscriber.onStateChanged.on((state) => console.log(state));

  setTimeout(() => {
    const streamer = eventsStoreClient.stream();
    streamer.onResult.on((result) => console.log(result));
    streamer.onError.on((error) => console.error(error));
    streamer.onStateChanged.on((state) => console.log(state));
    for (let i = 0; i < 20; i++) {
      streamer.write({ channel: 'events_store.stream', body: 'data' });
    }
  }, 2000);

  setTimeout(() => {
    eventsStoreClient.close();
  }, 4000);
}

main();
