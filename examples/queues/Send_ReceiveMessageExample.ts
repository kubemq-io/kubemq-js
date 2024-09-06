import { Config, QueuesClient, QueuesPollRequest, Utils } from '../../src';

async function main() {
  const opts: Config = {
    address: 'localhost:50000',
    clientId: 'kubeMQClientId-ts',
  };
  const queuesClient = new QueuesClient(opts);
  
  //Send to single channel
  await queuesClient
    .sendQueuesMessage({
      channel: 'queues.single',
      body: Utils.stringToBytes('queue message'),
      policy: {expirationSeconds:3600, delaySeconds:1, maxReceiveCount:3, maxReceiveQueue: 'dlq-queues.single'},
    })
    .then((result) => console.log(result))
    .catch((reason) => console.error(reason));

   //Receive Queue Messagece
const pollRequest = new QueuesPollRequest({
  channel: 'queues.single',
  pollMaxMessages: 1, // Maps to maxNumberOfMessages
  pollWaitTimeoutInSeconds: 10, // Maps to waitTimeoutSeconds
  autoAckMessages: false // Optional: add based on your needs
});

// Use the properties of QueuesPollRequest in the receiveQueuesMessages function
await queuesClient
  .receiveQueuesMessages(pollRequest)
  .then((response) => {
    console.log(response);
    response.messages.forEach((msg) => {
      console.log(msg);
      // Message handling options:

      // 1. Acknowledge message (mark as processed)
      // msg.ack();

      // 2. Reject message (won't be requeued)
      // msg.reject();

      // 3. Requeue message (send back to queue)
      // msg.reQueue(channelName);
    });
  })
  .catch((reason) => {
    console.error(reason);
  });
   
}

main();
