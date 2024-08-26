import { Config, QueuesClient, Utils } from '../../src';

async function main() {
  const opts: Config = {
    address: 'localhost:50000',
    clientId: Utils.uuid(),
  };
  const queuesClient = new QueuesClient(opts);
  //message will be delayed for 5 seconds
  await queuesClient
    .send({
      channel: 'queues.delayed',
      body: Utils.stringToBytes('queue message'),
      policy: {
        delaySeconds: 5,
      },
    })
    .then((result) => console.log(result))
    .catch((reason) => console.error(reason));
  //will wait for 5 seconds - no message will be received
  await queuesClient
    .pull({
      channel: 'queues.delayed',
      maxNumberOfMessages: 1,
      waitTimeoutSeconds: 5,
    })
    .then((response) => {
      console.log('Messages received:', response.messagesReceived);
    })
    .catch((reason) => {
      console.error(reason);
    });
  // will pull after 5 seconds and we should get the message
  await queuesClient
    .pull({
      channel: 'queues.delayed',
      maxNumberOfMessages: 1,
      waitTimeoutSeconds: 5,
    })
    .then((response) => {
      console.log('Messages received:', response.messagesReceived);
    })
    .catch((reason) => {
      console.error(reason);
    });
}

main();
