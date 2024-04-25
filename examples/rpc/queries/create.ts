import { Config, Utils, QueriesClient } from '../../../src';

const opts: Config = {
  address: 'localhost:50000',
  clientId: Utils.uuid(),
  reconnectInterval: 1000,
};
const queriesClient = new QueriesClient(opts);
async function create(channel: string) {
  return queriesClient.create(channel);
}

async function main() {
  await create('q2');
  // wait for receiver
}
main();
