import { Config, Utils, CQClient } from 'kubemq-js'

const opts: Config = {
  address: 'localhost:50000',
  clientId: 'kubeMQClientId-ts'
};
const cqClient = new CQClient(opts);


async function createCommandsChannel(channel: string) {
  return cqClient.createCommandsChannel(channel);
}

async function createQueriesChannel(channel: string) {
  return cqClient.createQueriesChannel(channel);
}

async function main() {
  await createCommandsChannel('my_commands_channel');
  await createQueriesChannel('my_queries_channel');
  // wait for receiver
}
main();
