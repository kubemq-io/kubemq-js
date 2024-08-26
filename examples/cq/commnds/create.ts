import { Config, Utils, CommandsClient } from '../../../src';

const opts: Config = {
  address: 'localhost:50000',
  clientId: Utils.uuid(),
  reconnectInterval: 1000,
};
const commandsClient = new CommandsClient(opts);
async function create(channel: string) {
  return commandsClient.create(channel);
}

async function main() {
  await create('c2');
  // wait for receiver
}
main();
