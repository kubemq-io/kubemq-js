import { Config, Utils, CQClient } from '../../../src';

const opts: Config = {
  address: 'localhost:50000',
  clientId: Utils.uuid(),
  reconnectInterval: 1000,
};
const queriesClient = new CQClient(opts);
async function create(channel: string) {
  return queriesClient.createQueriesChannel(channel);
}

async function main() {
  await create('q2');
  // wait for receiver
}
main();
