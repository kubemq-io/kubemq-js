import { Config, Utils, PubsubClient } from 'kubemq-js'

const opts: Config = {
  address: 'localhost:50000',
  clientId: 'kubeMQClientId-ts'
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
