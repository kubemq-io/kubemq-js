import { Config, Utils, EventsClient } from '../../../src';

const opts: Config = {
  address: 'localhost:50000',
  clientId: Utils.uuid(),
  reconnectInterval: 1000,
};
const eventsClient = new EventsClient(opts);
async function list(search: string) {
  const channels = await eventsClient.list(search);
  console.log(channels);
}

async function main() {
  await list('e1');
  // wait for receiver
}
main();
