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

  // *** Send message using stream
  const transactionRequest: QueueTransactionRequest = {
    channel: 'queues.stream',
    visibilitySeconds: 60,
    waitTimeoutSeconds: 60,
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
  
    // *** Send message using stream and extend visibility
    await queuesClient
    .send({
      channel: 'queues.visibility',
      body: Utils.stringToBytes('queue message'),
    })
    .then((result) => console.log(result))
    .catch((reason) => console.error(reason));

  const transactionRequest3: QueueTransactionRequest = {
    channel: 'queues.visibility',
    visibilitySeconds: 5,
    waitTimeoutSeconds: 60,
  };
  await queuesClient
    .transaction(transactionRequest3, async (err, msg) => {
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



  // *** Send message using stream and extend validdity
  await queuesClient
    .send({
      channel: 'queues.resend',
      body: Utils.stringToBytes('queue message'),
    })
    .then((result) => console.log(result))
    .catch((reason) => console.error(reason));

  const transactionRequest2: QueueTransactionRequest = {
    channel: 'queues.resend',
    visibilitySeconds: 5,
    waitTimeoutSeconds: 60,
  };
  await queuesClient
    .transaction(transactionRequest2, async (err, msg) => {
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
    waitTimeoutSeconds: 60,
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
