import { Config, QueuesClient, Utils } from '../../src';

async function main() {
  const opts: Config = {
    address: 'localhost:50000',
    clientId: Utils.uuid(),
  };
  const queuesClient = new QueuesClient(opts);
  //message will be set to expired after 5 seconds
  await queuesClient
    .send({
      channel: 'queues.expiration',
      body: Utils.stringToBytes('queue message'),
      policy: {
        expirationSeconds: 5,
      },
    })
    .then((result) => console.log(result))
    .catch((reason) => console.error(reason));

  //will wait for 5 seconds - no message will be received
  await new Promise((r) => setTimeout(r, 5000));

  await queuesClient
    .pull({
      channel: 'queues.expiration',
      maxNumberOfMessages: 1,
      waitTimeoutSeconds: 1,
    })
    .then((response) => {
      console.log('Messages received:', response.messagesReceived);
      console.log('Messages expired:', response.messagesExpired);
    })
    .catch((reason) => {
      console.error(reason);
    });
}

main();
