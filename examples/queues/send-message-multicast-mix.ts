import {
  PubsubClient,
  Utils,
  Config,
  EventStoreType,
  QueuesClient,
} from '../../src';

async function main() {
  const opts: Config = {
    address: 'localhost:50000',
    clientId: Utils.uuid(),
  };
  const eventsClient = new PubsubClient(opts);
  await eventsClient
    .subscribeToEvents(
      {
        channel: 'e1',
        clientId: 'Events-Subscriber',
      },
      (err, msg) => {
        if (err) {
          console.error('Events-Subscriber', err);
          return;
        }
        if (msg) {
          console.log('Events-Subscriber', msg);
        }
      },
    )
    .catch((reason) => {
      console.log(reason);
    });
  const eventsStoreClient = new PubsubClient(opts);
  await eventsStoreClient
    .subscribeToEventsStore(
      {
        channel: 'es1',
        clientId: 'Events-Store-Subscriber',
        requestType: EventStoreType.StartFromFirst,
        requestTypeValue: 2,
      },
      (err, msg) => {
        if (err) {
          console.error('Events-Store-Subscriber', err);
          return;
        }
        if (msg) {
          console.log('Events-Store-Subscriber', msg);
        }
      },
    )
    .catch((reason) => {
      console.log(reason);
    });
  const queuesClient = new QueuesClient(opts);
  await queuesClient
    .pull({
      channel: 'q1',
      clientId: 'Queue-Subscriber',
      maxNumberOfMessages: 1,
      waitTimeoutSeconds: 10,
    })
    .then((response) => {
      response.messages.forEach((msg) => {
        console.log(msg);
      });
    })
    .catch((reason) => {
      console.error(reason);
    });
  await new Promise((r) => setTimeout(r, 2000));
  await queuesClient.sendQueuesMessage({
    channel: 'q1;events:e1;events_store:es1',
    body: Utils.stringToBytes('event store multicast message'),
  });
}
main();
