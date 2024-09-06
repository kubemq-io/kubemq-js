import { Config, QueuesClient, Utils } from '../../src';

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
    })
    .then((result) => console.log(result))
    .catch((reason) => console.error(reason));

   //Receive Queue Message
   await queuesClient
    .receiveQueuesMessages({
      channel: 'q1',
      clientId: 'kubeMQClientId-ts',
      maxNumberOfMessages: 1,
      waitTimeoutSeconds: 10,
    })
    .then((response) => {
      response.messages.forEach((msg) => {
        console.log(msg);
        // Message handling options:

            // 1. Acknowledge message (mark as processed)
            msg.ack();

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
