import { Config, Utils, EventsClient } from '../../../src';

const opts: Config = {
  address: 'localhost:50000',
  clientId: Utils.uuid(),
  reconnectInterval: 1000,
};
const eventsClient = new EventsClient(opts);
async function deleteChannel(channel: string) {
  return eventsClient.delete(channel);
}

async function main() {
  await deleteChannel('e1');
  // wait for receiver
}
main();
