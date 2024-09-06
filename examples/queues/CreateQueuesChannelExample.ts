import { Config, Utils, QueuesClient } from '../../src';

const opts: Config = {
  address: 'localhost:50000',
  clientId: 'kubeMQClientId-ts',
  reconnectInterval: 1000,
};
const queuesClient = new QueuesClient(opts);
async function createQueueChannel(channel: string) {
  return queuesClient.createQueuesChannel(channel);
}

async function main() {
  await createQueueChannel('mytest-channel');
  // wait for receiver
}
main();
