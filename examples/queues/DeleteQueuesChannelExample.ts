import { Config, Utils, QueuesClient } from '../../src';

const opts: Config = {
  address: 'localhost:50000',
  clientId: 'kubeMQClientId-ts',
  reconnectInterval: 1000,
};
const queuesClient = new QueuesClient(opts);
async function deleteChannel(channel: string) {
  return queuesClient.deleteQueuesChannel(channel);
}

async function main() {
  await deleteChannel('mytest-channel');
  // wait for receiver
}
main();
