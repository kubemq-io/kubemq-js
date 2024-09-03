import { Config, PubsubClient, Utils } from '../../../src';

async function main() {
  const opts: Config = {
    address: 'localhost:50000',
    clientId: Utils.uuid(),
  };
  const pubsubClient = new PubsubClient(opts);

  await pubsubClient.sendEventStoreMessage({
    channel: 'events_store.single',
    body: Utils.stringToBytes('event store message'),
  });
}
main();
