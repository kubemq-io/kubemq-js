import { Config, EventsStoreClient, EventStoreType, Utils } from '../../../src';

async function main() {
  const opts: Config = {
    address: 'localhost:50000',
    clientId: Utils.uuid(),
  };
  const eventsStoreClient = new EventsStoreClient(opts);
  const channel = Utils.uuid();
  for (let i = 0; i < 10; i++) {
    await eventsStoreClient
      .send({
        channel: channel,
        body: Utils.stringToBytes(`event store message - ${i + 1}`),
      })
      .then(() => console.log(`message ${i + 1} sent`));
    await new Promise((r) => setTimeout(r, 1000));
  }

  //get messages from start
  await eventsStoreClient
    .subscribe(
      {
        channel: channel,
        clientId: 'subscriber-from-start',
        requestType: EventStoreType.StartFromFirst,
      },
      (err, msg) => {
        if (err) {
          console.error(err);
          return;
        }
        if (msg) {
          console.log(
            `subscriber-from-start: ${Utils.bytesToString(msg.body)}`,
          );
        }
      },
    )
    .catch((reason) => {
      console.log(reason);
    });

  // get messages from seq 5
  await eventsStoreClient
    .subscribe(
      {
        channel: channel,
        clientId: 'subscriber-at-sequence',
        requestType: EventStoreType.StartAtSequence,
        requestTypeValue: 5,
      },
      (err, msg) => {
        if (err) {
          console.error(err);
          return;
        }
        if (msg) {
          console.log(
            `subscriber-at-sequence: ${Utils.bytesToString(msg.body)}`,
          );
        }
      },
    )
    .catch((reason) => {
      console.log(reason);
    });
  //get messages from last
  await eventsStoreClient
    .subscribe(
      {
        channel: channel,
        clientId: 'subscriber-from-last',
        requestType: EventStoreType.StartFromLast,
      },
      (err, msg) => {
        if (err) {
          console.error(err);
          return;
        }
        if (msg) {
          console.log(`subscriber-from-last: ${Utils.bytesToString(msg.body)}`);
        }
      },
    )
    .catch((reason) => {
      console.log(reason);
    });

  // starts from 3 seconds ago
  await eventsStoreClient
    .subscribe(
      {
        channel: channel,
        clientId: 'subscriber-from-delta',
        requestType: EventStoreType.StartAtTimeDelta,
        requestTypeValue: 3,
      },
      (err, msg) => {
        if (err) {
          console.error(err);
          return;
        }
        if (msg) {
          console.log(
            `subscriber-from-delta: ${Utils.bytesToString(msg.body)}`,
          );
        }
      },
    )
    .catch((reason) => {
      console.log(reason);
    });
  // starts from time
  await eventsStoreClient
    .subscribe(
      {
        channel: channel,
        clientId: 'subscriber-from-time',
        requestType: EventStoreType.StartAtTimeDelta,
        requestTypeValue: Math.floor(new Date().getTime() / 1000) - 5,
      },
      (err, msg) => {
        if (err) {
          console.error(err);
          return;
        }
        if (msg) {
          console.log(`subscriber-from-time: ${Utils.bytesToString(msg.body)}`);
        }
      },
    )
    .catch((reason) => {
      console.log(reason);
    });
}
main();
