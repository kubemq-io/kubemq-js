import { Config, QueuesClient, Utils } from '../../src';

async function main() {
  const opts: Config = {
    address: 'localhost:50000',
    clientId: Utils.uuid(),
  };
  const queuesClient = new QueuesClient(opts);
  await queuesClient
    .send({
      channel: 'queues.A;queues.B',
      body: Utils.stringToBytes('queue message'),
    })
    .then((result) => console.log(result))
    .catch((reason) => console.error(reason));

  await queuesClient
    .pull({
      channel: 'queues.A',
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
  await queuesClient
    .pull({
      channel: 'queues.B',
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
