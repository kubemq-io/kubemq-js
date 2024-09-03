import { Config, Utils, PubsubClient } from '../../../src';

const opts: Config = {
  address: 'localhost:50000',
  clientId: Utils.uuid(),
  reconnectInterval: 1000,
};
const pubsubClient = new PubsubClient(opts);
async function create(channel: string) {
  return pubsubClient.createEventsChannel(channel);
}

async function main() {
  await create('e1');
  // wait for receiver
}
main();
