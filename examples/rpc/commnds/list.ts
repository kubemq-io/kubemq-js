import { Config, Utils, CommandsClient } from '../../../src';

const opts: Config = {
  address: 'localhost:50000',
  clientId: Utils.uuid(),
  reconnectInterval: 1000,
};
const commandsClient = new CommandsClient(opts);
async function list(search: string) {
  const channels = await commandsClient.list(search);
  console.log(channels);
}

async function main() {
  await list('');
  // wait for receiver
}
main();
