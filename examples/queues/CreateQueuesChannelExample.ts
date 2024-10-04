import { Config, QueuesClient } from 'kubemq-js'

const opts: Config = {
  address: 'localhost:50000',
  clientId: 'kubeMQClientId-ts'
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
