import { Config, Utils, EventsStoreClient } from '../../../src';

const opts: Config = {
  address: 'localhost:50000',
  clientId: Utils.uuid(),
  reconnectInterval: 1000,
};
const eventsStoreClient = new EventsStoreClient(opts);
async function create(channel: string) {
  return eventsStoreClient.create(channel);
}

async function main() {
  await create('es333');
  // wait for receiver
}
main();
