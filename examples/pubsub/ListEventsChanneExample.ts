import { Config, PubsubClient } from 'kubemq-js'

const opts: Config = {
  address: 'localhost:50000',
  clientId: 'kubeMQClientId-ts'
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
  await listEventsChannel('');
  await listEventsStoreChannel('');
  // wait for receiver
}
main();
