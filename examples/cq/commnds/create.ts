import { Config, Utils, CQClient } from '../../../src';

const opts: Config = {
  address: 'localhost:50000',
  clientId: Utils.uuid(),
  reconnectInterval: 1000,
};
const cqClient = new CQClient(opts);
async function create(channel: string) {
  return cqClient.createCommandsChannel(channel);
}

async function main() {
  await create('c2');
  // wait for receiver
}
main();
