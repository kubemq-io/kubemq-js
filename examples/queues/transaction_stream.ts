import { Config, QueuesClient, Utils } from '../../src';

const opts: Config = {
  address: 'localhost:50000',
  clientId: Utils.uuid(),
  reconnectInterval: 5000,
};
const queuesClient = new QueuesClient(opts);

const sendMessages = async () => {
  for (let i = 0; i < 100; i++) {
    await queuesClient
      .send({
        channel: 'queues.stream',
        body: Utils.stringToBytes('queue message'),
      })
      .then((value) => console.log(`message ${i} - sent, id: ${value.id}`))
      .catch((reason) =>
        console.log(`message ${i} - error, code: ${reason.code}`),
      );
    await new Promise((r) => setTimeout(r, 1000));
  }
};

const cb = (err: Error, msg) => {
  if (err) {
    console.log(err);
  }
  if (msg) {
    console.log('Message Received:');
    console.log(msg.message);
    msg
      .ack()
      .then(() => console.log('Message ack'))
      .catch((reason) => console.error(reason));
  }
};
sendMessages();
queuesClient
  .transactionStream(
    {
      channel: 'queues.stream',
      visibilitySeconds: 60,
      waitTimeoutSeconds: 1,
    },
    cb,
  )
  .then(async (value) => {
    value.onError.on((err) => {
      console.log(err);
    });
    await new Promise((r) => setTimeout(r, 2000000));
    console.log('done');
    value.unsubscribe();
  });
