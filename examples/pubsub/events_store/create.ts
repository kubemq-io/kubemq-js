import { Config, Utils, PubsubClient } from '../../../src';

const opts: Config = {
  address: 'localhost:50000',
  clientId: Utils.uuid(),
  reconnectInterval: 1000,
};
const eventsStoreClient = new PubsubClient(opts);
async function create(channel: string) {
  return eventsStoreClient.createEventsStoreChannel(channel);
}

async function main() {
  await create('es333');
  // wait for receiver
}
main();
