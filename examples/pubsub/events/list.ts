import { Config, Utils, PubsubClient } from '../../../src';

const opts: Config = {
  address: 'localhost:50000',
  clientId: Utils.uuid(),
  reconnectInterval: 1000,
};
const pubsubClient = new PubsubClient(opts);
async function list(search: string) {
  const channels = await pubsubClient.listEventsChannels(search);
  console.log(channels);
}

async function main() {
  await list('e1');
  // wait for receiver
}
main();
