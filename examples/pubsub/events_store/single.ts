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
        channel: 'events_store.single',
        clientId: 'subscriber',
        requestType: EventStoreType.StartFromFirst,
      },
      (err, msg) => {
        if (err) {
          console.error(err);
          return;
        }
        if (msg) {
          console.log(msg);
        }
      },
    )
    .catch((reason) => {
      console.log(reason);
    });
  await new Promise((r) => setTimeout(r, 2000));
  await eventsStoreClient.send({
    channel: 'events_store.single',
    body: Utils.stringToBytes('event store message'),
  });
}
main();
