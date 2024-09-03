import {
  PubsubClient,
  Utils,
  Config,
  EventStoreType,
  QueuesClient,
} from '../../../src';

async function main() {
  const opts: Config = {
    address: 'localhost:50000',
    clientId: Utils.uuid(),
  };
  const pubsubClient = new PubsubClient(opts);
  await pubsubClient
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
 
  await pubsubClient
    .subscribeToEventsStore(
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
  await pubsubClient.sendEventStoreMessage({
    channel: 'es1;events:e1;queues:q1',
    body: Utils.stringToBytes('event store multicast message'),
  });
}
main();
