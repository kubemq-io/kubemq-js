import { Config, Utils, EventsStoreClient } from '../../../src';

const opts: Config = {
  address: 'localhost:50000',
  clientId: Utils.uuid(),
  reconnectInterval: 1000,
};
const eventsStoreClient = new EventsStoreClient(opts);
async function list(search: string) {
  const channels = await eventsStoreClient.list(search);
  console.log(channels);
}

async function main() {
  await list('');
  // wait for receiver
}
main();
