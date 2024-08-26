import { Config, Utils, CommandsClient } from '../../../src';

const opts: Config = {
  address: 'localhost:50000',
  clientId: Utils.uuid(),
  reconnectInterval: 1000,
};
const commandsClient = new CommandsClient(opts);
async function deleteChannel(channel: string) {
  return commandsClient.delete(channel);
}

async function main() {
  await deleteChannel('c2');
  // wait for receiver
}
main();
