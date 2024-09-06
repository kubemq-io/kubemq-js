import { Config, Utils, CQClient } from '../../src';

const opts: Config = {
  address: 'localhost:50000',
  clientId: 'kubeMQClientId-ts',
  reconnectInterval: 1000,
};
const cqClient = new CQClient(opts);

/**
 * Deletes a command channel.
 * @param channel 
 * @returns 
 */
async function deleteCommandsChannel(channel: string) {
  return cqClient.deleteCommandsChannel(channel);
}

/**
 * Deletes a queries channel.
 * @param channel 
 * @returns 
 */
async function deleteQueriesChannel(channel: string) {
  return cqClient.deleteQueriesChannel(channel);
}


async function main() {
  await deleteCommandsChannel('my_commands_channel');
  await deleteQueriesChannel('my_queries_channel');

  // wait for receiver
}
main();
