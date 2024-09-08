import { Config, Utils, CQClient } from '../../src';

const opts: Config = {
  address: 'localhost:50000',
  clientId: 'kubeMQClientId-ts',
  reconnectInterval: 1000,
};
const cqClient = new CQClient(opts);

/**
 * List command channels, use search string to search
 * @param search 
 */
async function listCommandsChannels(search: string) {
  const channels = await cqClient.listCommandsChannels(search);
  console.log(channels);
}

/**
 * List queries channels, use search string to search
 * @param search 
 */
async function listQueriesChannels(search: string) {
  const channels = await cqClient.listQueriesChannels(search);
  console.log(channels);
}

async function main() {
  await listCommandsChannels('my_commands_');
  await listQueriesChannels('my_queries_');
  // wait for receiver
}
main();
