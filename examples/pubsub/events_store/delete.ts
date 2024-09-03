import { Config, Utils, PubsubClient } from '../../../src';

const opts: Config = {
  address: 'localhost:50000',
  clientId: Utils.uuid(),
  reconnectInterval: 1000,
};
const eventsStoreClient = new PubsubClient(opts);
async function deleteChannel(channel: string) {
  return eventsStoreClient.deleteEventsStoreChannel(channel);
}

async function main() {
  await deleteChannel('es333');
  // wait for receiver
}
main();
