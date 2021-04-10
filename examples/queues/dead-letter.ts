import {
  Config,
  QueuesClient,
  QueueTransactionRequest,
  Utils,
} from '../../src';

async function main() {
  const opts: Config = {
    address: 'localhost:50000',
    clientId: Utils.uuid(),
  };
  const queuesClient = new QueuesClient(opts);

  await queuesClient
    .send({
      channel: 'queues.some-queue',
      body: Utils.stringToBytes('queue message'),
      policy: {
        maxReceiveCount: 1,
        maxReceiveQueue: 'queues.dead-letter',
      },
    })
    .then((result) => console.log(result))
    .catch((reason) => console.error(reason));

  // we will reject the message and the message will be move to the dead-letter queue
  const transactionRequest: QueueTransactionRequest = {
    channel: 'queues.some-queue',
    visibilitySeconds: 60,
    waitTimeoutSeconds: 60,
  };
  await queuesClient
    .transaction(transactionRequest, (err, msg) => {
      if (err) {
        console.log(err);
      }
      if (msg) {
        msg.reject().catch((reason) => console.error(reason));
      }
    })
    .catch((reason) => {
      console.error(reason);
    });

  await queuesClient
    .pull({
      channel: 'queues.dead-letter',
      maxNumberOfMessages: 1,
      waitTimeoutSeconds: 5,
    })
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
