import { Config, QueuesClient, Utils } from '../../src';

async function main() {
  const opts: Config = {
    address: 'localhost:50000',
    clientId: Utils.uuid(),
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

    // Send to multiple channel
    await queuesClient
    .sendQueuesMessage({
      channel: 'queues.A;queues.B',
      body: Utils.stringToBytes('queue message'),
    })
    .then((result) => console.log(result))
    .catch((reason) => console.error(reason));
}

main();
