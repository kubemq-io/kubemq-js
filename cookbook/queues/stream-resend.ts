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
      channel: 'queues.resend',
      body: Utils.stringToBytes('queue message'),
    })
    .then((result) => console.log(result))
    .catch((reason) => console.error(reason));

  const transactionRequest: QueueTransactionRequest = {
    channel: 'queues.resend',
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
        // after 2 seconds will resend the message to another queue
        await new Promise((r) => setTimeout(r, 2000));
        msg
          .resendToChannel('queues.resend.new')
          .then(() => console.log('message resend'))
          .catch((reason) => console.error(reason));
      }
    })
    .catch((reason) => {
      console.error(reason);
    });
  // pull from new resend message
  const transactionResendRequest: QueueTransactionRequest = {
    channel: 'queues.resend.new',
    visibilitySeconds: 5,
    waitTimoutSeconds: 60,
  };
  await queuesClient
    .transaction(transactionResendRequest, async (err, msg) => {
      if (err) {
        console.log(err);
      }
      if (msg) {
        console.log('processing resend queue message');
        // after 2 seconds and ack the message
        await new Promise((r) => setTimeout(r, 2000));
        msg
          .ack()
          .then(() => console.log('resend message ack'))
          .catch((reason) => console.error(reason));
      }
    })
    .catch((reason) => {
      console.error(reason);
    });
}
main();
