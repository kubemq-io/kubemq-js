import { Config, Utils, PubsubClient } from '../../../src';

const opts: Config = {
  address: 'localhost:50000',
  clientId: Utils.uuid(),
  reconnectInterval: 1000,
};
const eventsStoreClient = new PubsubClient(opts);
async function list(search: string) {
  const channels = await eventsStoreClient.listEventsStoreChannels(search);
  console.log(channels);
}

async function main() {
  await list('');
  // wait for receiver
}
main();
