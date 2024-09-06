import { Config, Utils, PubsubClient } from '../../src';

const opts: Config = {
  address: 'localhost:50000',
  clientId: 'kubeMQClientId-ts',
  reconnectInterval: 1000,
};
const pubsubClient = new PubsubClient(opts);


async function listEventsChannel(search: string) {
  const channels = await pubsubClient.listEventsChannels(search);
  console.log(channels);
}


async function listEventsStoreChannel(search: string) {
  const channels = await pubsubClient.listEventsStoreChannels(search);
  console.log(channels);
}

async function main() {
  await listEventsChannel('mytest-channel');
  await listEventsStoreChannel('mytest-channel-eventstore');
  // wait for receiver
}
main();
