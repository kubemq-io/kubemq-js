import { Utils, PubsubClient, Config } from '../../../src';

async function main() {
  const opts: Config = {
    address: 'localhost:50000',
    clientId: Utils.uuid(),
  };
  const eventsClient = new PubsubClient(opts);
  
  // Send message to single channle
  await eventsClient.sendEventsMessage({
    channel: 'events.single',
    body: Utils.stringToBytes('event message'),
  });

  // Send message to multiple channel
  for (let i = 0; i < 10; i++) {
    await eventsClient.sendEventsMessage({
      channel: 'events.A;events.B',
      body: Utils.stringToBytes('event message'),
    });
  }
}
main();
