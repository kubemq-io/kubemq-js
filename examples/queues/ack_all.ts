import { Config, QueuesClient, Utils, QueueMessage } from '../../src';

async function main() {
  const opts: Config = {
    address: 'localhost:50000',
    clientId: Utils.uuid(),
  };
  const queuesClient = new QueuesClient(opts);

  const batchMessages: QueueMessage[] = [];
  for (let i = 0; i < 10; i++) {
    batchMessages.push({
      channel: 'queues.ack_all',
      body: Utils.stringToBytes('queue message'),
    });
  }
  await queuesClient
    .batch(batchMessages)
    .catch((reason) => console.error(reason));

  await queuesClient
    .ackAll({
      channel: 'queues.ack_all',
      waitTimeoutSeconds: 6,
    })
    .then((response) => console.log(response))
    .catch((reason) => console.error(reason));

  // no message will be received
  await queuesClient
    .pull({
      channel: 'queues.ack_all',
      maxNumberOfMessages: 10,
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
