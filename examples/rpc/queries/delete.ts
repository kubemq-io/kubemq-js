import { Config, Utils, QueriesClient } from '../../../src';

const opts: Config = {
  address: 'localhost:50000',
  clientId: Utils.uuid(),
  reconnectInterval: 1000,
};
const queriesClient = new QueriesClient(opts);
async function deleteChannel(channel: string) {
  return queriesClient.delete(channel);
}

async function main() {
  await deleteChannel('q2');
  // wait for receiver
}
main();
