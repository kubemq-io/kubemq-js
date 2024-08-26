import { Config, Utils, QueriesClient } from '../../../src';

const opts: Config = {
  address: 'localhost:50000',
  clientId: Utils.uuid(),
  reconnectInterval: 1000,
};
const queriesClient = new QueriesClient(opts);
async function list(search: string) {
  const channels = await queriesClient.list(search);
  console.log(channels);
}

async function main() {
  await list('');
  // wait for receiver
}
main();
