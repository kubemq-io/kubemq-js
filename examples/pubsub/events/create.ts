import { Config, Utils, EventsClient } from '../../../src';

const opts: Config = {
  address: 'localhost:50000',
  clientId: Utils.uuid(),
  reconnectInterval: 1000,
};
const eventsClient = new EventsClient(opts);
async function create(channel: string) {
  return eventsClient.create(channel);
}

async function main() {
  await create('e1');
  // wait for receiver
}
main();
