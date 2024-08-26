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
        channel: 'events_store.stream',
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
  const sender = eventsStoreClient
    .stream((err, result) => {
      if (err) {
        console.error(err);
        return;
      }
      if (result) {
        console.log(result);
      }
    })
    .catch((reason) => {
      console.log(reason);
    });

  sender.then((res) => {
    if (res) {
      for (let i = 0; i < 10; i++) {
        res.write({
          channel: 'events_store.stream',
          body: Utils.stringToBytes('event message'),
        });
      }
    }
  });
}
main();
