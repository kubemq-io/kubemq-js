import { Config, Utils, CQClient } from '../../../src';

const opts: Config = {
  address: 'localhost:50000',
  clientId: Utils.uuid(),
  reconnectInterval: 1000,
};
const cqClient = new CQClient(opts);
async function list(search: string) {
  const channels = await cqClient.listQueriesChannels(search);
  console.log(channels);
}

async function main() {
  await list('');
  // wait for receiver
}
main();
