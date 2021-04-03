import { Config } from '../../../src';
import { Utils } from '../../../src/utils';
import { EventsClient, EventsReceiveMessage } from '../../../src/events';

const opts: Config = {
  address: 'localhost:50000',
  clientId: Utils.uuid(),
};
const eventsClient = new EventsClient(opts);
const subscriber = eventsClient.subscribe({
  channel: 'events.stream',
  onEventFn: (event: EventsReceiveMessage) => {
    console.log(event);
  },
  onErrorFn: (e) => {
    console.error(e);
  },
  onCloseFn: () => {
    console.log('close');
  },
});

setTimeout(() => {
  const streamer = eventsClient.stream({
    onErrorFn: (e) => {
      console.error(e);
    },
    onCloseFn: () => {
      console.log('close');
    },
  });
  for (let i = 0; i < 20; i++) {
    streamer.write({ channel: 'events.stream', body: 'data' });
  }
}, 2000);

setTimeout(() => {
  subscriber.cancel();
}, 4000);
