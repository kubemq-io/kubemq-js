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
      channel: 'queues.visibility',
      body: Utils.stringToBytes('queue message'),
    })
    .then((result) => console.log(result))
    .catch((reason) => console.error(reason));

  const transactionRequest: QueueTransactionRequest = {
    channel: 'queues.visibility',
    visibilitySeconds: 5,
    waitTimoutSeconds: 60,
  };
  await queuesClient
    .transaction(transactionRequest, async (err, msg) => {
      if (err) {
        console.log(err);
      }
      if (msg) {
        console.log('processing queue message');
        // after 2 seconds will extend the visibility by another 5 seconds
        await new Promise((r) => setTimeout(r, 2000));
        msg
          .extendVisibility(5)
          .then(() => console.log('visibility extended'))
          .catch((reason) => console.error(reason));

        // will continue to process the message for another 4 sec and ack the message
        await new Promise((r) => setTimeout(r, 4000));
        msg
          .ack()
          .then(() => console.log('visibility message ack'))
          .catch((reason) => console.error(reason));
      }
    })
    .catch((reason) => {
      console.error(reason);
    });
}
main();
