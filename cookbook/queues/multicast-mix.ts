import {
  Config,
  EventsClient,
  EventsStoreClient,
  EventStoreType,
  QueuesClient,
  Utils,
} from '../../src';

async function main() {
  const eventsOpts: Config = {
    address: 'localhost:50000',
    clientId: Utils.uuid(),
  };
  const eventsClient = new EventsClient(eventsOpts);
  await eventsClient
    .subscribe({ channel: 'e1' }, (err, msg) => {
      if (err) {
        console.error(err);
        return;
      }
      if (msg) {
        console.log('Events Message:');
        console.log(msg);
      }
    })
    .catch((reason) => {
      console.log(reason);
    });

  const eventsStoreOpts: Config = {
    address: 'localhost:50000',
    clientId: Utils.uuid(),
  };
  const eventsStoreClient = new EventsStoreClient(eventsStoreOpts);
  await eventsStoreClient
    .subscribe(
      { channel: 'es1', requestType: EventStoreType.StartFromFirst },
      (err, msg) => {
        if (err) {
          console.error(err);
          return;
        }
        if (msg) {
          console.log('Events Store Message:');
          console.log(msg);
        }
      },
    )
    .catch((reason) => {
      console.log(reason);
    });

  const queuesOpts: Config = {
    address: 'localhost:50000',
    clientId: Utils.uuid(),
  };
  const queuesClient = new QueuesClient(queuesOpts);
  await queuesClient
    .send({
      channel: 'queues.main;events:e1;events_store:es2',
      body: Utils.stringToBytes('queue message'),
    })
    .then((result) => console.log(result))
    .catch((reason) => console.error(reason));

  await queuesClient
    .pull({ channel: 'queues.main', maxNumberOfMessages: 1, waitTimeout: 5 })
    .then((response) => {
      response.messages.forEach((msg) => {
        console.log(msg);
      });
    })
    .catch((reason) => {
      console.error(reason);
    });
}

main();
