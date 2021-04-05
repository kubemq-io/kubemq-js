import {
  Config,
  QueuesClient,
  QueueTransactionRequest,
  Utils,
} from '../../src';

const opts: Config = {
  address: 'localhost:50000',
  clientId: Utils.uuid(),
};
const queuesClient = new QueuesClient(opts);
const transactionRequest: QueueTransactionRequest = {
  channel: 'queues.stream',
  visibilitySeconds: 60,
  waitTimoutSeconds: 60,
};
queuesClient
  .send({
    channel: 'queues.stream',
    body: Utils.stringToBytes('queue message'),
  })
  .then((result) => console.log(result))
  .catch((reason) => console.error(reason));

queuesClient
  .transaction(transactionRequest, (err, msg) => {
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
  })
  .catch((reason) => {
    console.error(reason);
  });
