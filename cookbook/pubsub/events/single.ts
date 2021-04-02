import { Config } from '../../../src/config';
import { Utils } from '../../../src/utils';
import { EventsClient, EventsReceiveMessage } from '../../../src/events';

const opts: Config = {
  address: 'localhost:50000',
  clientId: Utils.uuid(),
};
const eventsClient = new EventsClient(opts);
const subscriber = eventsClient.subscribe({
  channel: 'events.single',
  onDataFn: (event: EventsReceiveMessage) => {
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
  for (let i = 0; i < 20; i++) {
    eventsClient
      .send({ channel: 'events.single', body: 'data' })
      .catch((reason) => console.error(reason));
  }
}, 2000);

setTimeout(() => {
  subscriber.cancel();
}, 4000);
