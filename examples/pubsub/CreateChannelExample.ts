import { Config, Utils, PubsubClient } from 'kubemq-js'

const opts: Config = {
  address: 'localhost:50000',
  clientId: 'kubeMQClientId-ts'
};
const pubsubClient = new PubsubClient(opts);

/**
* Creates an events channel using the PubSubClient.
*/
async function createEventsChannel(channel: string) {
  return pubsubClient.createEventsChannel(channel);
}

/**
* Creates an events store channel using the PubSubClient.
*/
async function createEventsStoreChannel(channel: string) {
  return pubsubClient.createEventsStoreChannel(channel);
}

async function main() {
  await createEventsChannel('mytest-channel');
  await createEventsStoreChannel('mytest-channel-eventstore');
  // wait for receiver
}
main();
