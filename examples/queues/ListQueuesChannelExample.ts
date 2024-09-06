import { Config, Utils, QueuesClient } from '../../src';

const opts: Config = {
  address: 'localhost:50000',
  clientId: 'kubeMQClientId-ts',
  reconnectInterval: 1000,
};
const queuesClient = new QueuesClient(opts);

async function listQueueChannels(search: string) {
  const channels = await queuesClient.listQueuesChannel(search);
  console.log(channels);
}

async function main() {
  await listQueueChannels('');
  // wait for receiver
}
main();
