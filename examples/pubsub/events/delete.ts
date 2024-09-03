import { Config, Utils, PubsubClient } from '../../../src';

const opts: Config = {
  address: 'localhost:50000',
  clientId: Utils.uuid(),
  reconnectInterval: 1000,
};
const pubsubClient = new PubsubClient(opts);
async function deleteChannel(channel: string) {
  return pubsubClient.deleteEventsChannel(channel);
}

async function main() {
  await deleteChannel('e1');
  // wait for receiver
}
main();
