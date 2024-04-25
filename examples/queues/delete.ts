import { Config, Utils, QueuesClient } from '../../src';

const opts: Config = {
  address: 'localhost:50000',
  clientId: Utils.uuid(),
  reconnectInterval: 1000,
};
const queuesClient = new QueuesClient(opts);
async function deleteChannel(channel: string) {
  return queuesClient.delete(channel);
}

async function main() {
  await deleteChannel('qu1');
  // wait for receiver
}
main();
