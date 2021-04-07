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
      channel: 'queues.peek',
      body: Utils.stringToBytes('queue message'),
    });
  }

  await queuesClient
    .batch(batchMessages)
    .catch((reason) => console.error(reason));

  // peeking messages , the messages stays in queue
  await queuesClient
    .peek({ channel: 'queues.peek', maxNumberOfMessages: 10, waitTimeout: 20 })
    .then((response) => {
      response.messages.forEach((msg) => {
        console.log(msg);
      });
    })
    .catch((reason) => {
      console.error(reason);
    });

  //message pulling from queue
  await queuesClient
    .pull({ channel: 'queues.peek', maxNumberOfMessages: 10, waitTimeout: 20 })
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
