import { EventsClient, Utils, Config } from '../../../src';

const opts: Config = {
  address: 'localhost:50000',
  clientId: Utils.uuid(),
};
const eventsClient = new EventsClient(opts);
const subscriber = eventsClient.subscribe({
  channel: 'events.stream',
});
subscriber.onEvent.on((event) => console.log(event));
subscriber.onError.on((error) => console.error(error));
subscriber.onStateChanged.on((state) => console.log(state));
setTimeout(() => {
  const streamer = eventsClient.stream();
  streamer.onResult.on((result) => console.log(result));
  streamer.onError.on((error) => console.error(error));
  streamer.onStateChanged.on((state) => console.log(state));
  for (let i = 0; i < 20; i++) {
    streamer.write({
      channel: 'events.stream',
      body: Utils.stringToBytes('data'),
    });
  }
}, 2000);

setTimeout(() => {
  eventsClient.close();
}, 4000);
