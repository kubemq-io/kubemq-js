import { Config, Utils, PubsubClient } from '../../src';

const opts: Config = {
  address: 'localhost:50000',
  clientId: 'kubeMQClientId-ts',
  reconnectInterval: 1000,
};
const pubsubClient = new PubsubClient(opts);

/**
 * Deletes an events channel with the specified name.
 */
async function deleteEventsChannel(channel: string) {
  return pubsubClient.deleteEventsChannel(channel);
}

/**
 * Deletes an events store channel with the specified name.
 */
async function deleteEventsStoreChannel(channel: string) {
  return pubsubClient.deleteEventsStoreChannel(channel);
}

async function main() {
  await deleteEventsChannel('mytest-channel');
  await deleteEventsStoreChannel('mytest-channel-eventstore');
  // wait for receiver
}
main();
