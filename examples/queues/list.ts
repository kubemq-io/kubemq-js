import { Config, Utils, QueuesClient } from '../../src';

const opts: Config = {
  address: 'localhost:50000',
  clientId: Utils.uuid(),
  reconnectInterval: 1000,
};
const queuesClient = new QueuesClient(opts);
async function list(search: string) {
  const channels = await queuesClient.listQueuesChannel(search);
  console.log(channels);
}

async function main() {
  await list('');
  // wait for receiver
}
main();
