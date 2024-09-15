import { Config,  QueuesClient } from 'kubemq-js'

const opts: Config = {
  address: 'localhost:50000',
  clientId: 'kubeMQClientId-ts'
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
