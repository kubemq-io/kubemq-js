import { Config, Utils, QueuesClient } from '../../src';

const opts: Config = {
  address: 'localhost:50000',
  clientId: Utils.uuid(),
  reconnectInterval: 1000,
};
const queuesClient = new QueuesClient(opts);
async function create(channel: string) {
  return queuesClient.createQueuesChannel(channel);
}

async function main() {
  await create('qu1');
  // wait for receiver
}
main();
