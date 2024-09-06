import { Utils, PubsubClient, Config } from '../../src';

async function main() {
  const opts: Config = {
    address: 'localhost:50000',
    clientId: Utils.uuid(),
  };
  const pubsubClient = new PubsubClient(opts);
  
  //Sends an event message to the configured events channel.
  await pubsubClient.sendEventsMessage({
    channel: 'events.single',
    body: Utils.stringToBytes('event message'),
  });


  //Sends an event store message to the configured events store channel.
  await pubsubClient.sendEventStoreMessage({
    channel: 'events_store.single',
    body: Utils.stringToBytes('event store message'),
  });

}
main();
