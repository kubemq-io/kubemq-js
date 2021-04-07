import {
  EventsClient,
  Utils,
  Config,
  EventsStoreClient,
  EventStoreType,
  QueuesClient,
} from '../../../src';

async function main() {
  const opts: Config = {
    address: 'localhost:50000',
    clientId: Utils.uuid(),
  };
  const eventsClient = new EventsClient(opts);
  await eventsClient
    .subscribe(
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
  const eventsStoreClient = new EventsStoreClient(opts);
  await eventsStoreClient
    .subscribe(
      {
        channel: 'es1',
        clientId: 'Events-Store-Subscriber',
        requestType: EventStoreType.StartFromFirst,
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
  await eventsClient.send({
    channel: 'e1;events_store:es1;queues:q1',
    body: Utils.stringToBytes('event multicast message'),
  });
}
main();
