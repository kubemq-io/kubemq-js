import { Utils, PubsubClient, Config } from 'kubemq-js'

async function main() {
  const opts: Config = {
    address: 'localhost:50000',
    clientId: Utils.uuid(),
  };
  const pubsubClient = new PubsubClient(opts);
  
  //Sends an event message to the configured events channel.
  await pubsubClient.sendEventsMessage({
    channel: 'events.A',
    body: Utils.stringToBytes('event message'),
  });


  //Sends an event store message to the configured events store channel.
  const result = await pubsubClient.sendEventStoreMessage({
    channel: 'events_store.A',
    body: Utils.stringToBytes('event store message'),
  })

  // Print the result
  console.log('EventsSendResult:', result);
  console.log(`ID: ${result.id}`);
  console.log(`Sent: ${result.sent}`);
  if (result.error) {
    console.error(`Error: ${result.error}`);
  }

}
main();
