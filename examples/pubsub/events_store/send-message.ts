import { Config, EventsStoreClient, EventStoreType, Utils } from '../../../src';

async function main() {
  const opts: Config = {
    address: 'localhost:50000',
    clientId: Utils.uuid(),
  };
  const eventsStoreClient = new EventsStoreClient(opts);

  await eventsStoreClient.send({
    channel: 'events_store.single',
    body: Utils.stringToBytes('event store message'),
  });
}
main();
