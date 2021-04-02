import { Config } from '../../../src/config';
import { Utils } from '../../../src/utils';
import { EventsClient, EventsReceiveMessage } from '../../../src/events';

const opts: Config = {
  address: 'localhost:50000',
  clientId: Utils.uuid(),
};
const eventsClient = new EventsClient(opts);
const subscriberA = eventsClient.subscribe({
  channel: 'events.A',

  onDataFn: (event: EventsReceiveMessage) => {
    console.log('SubscriberA', event);
  },
  onErrorFn: (e) => {
    console.error(e);
  },
  onCloseFn: () => {
    console.log('close');
  },
});

const subscriberB = eventsClient.subscribe({
  channel: 'events.B',
  group: 'g1',
  onDataFn: (event: EventsReceiveMessage) => {
    console.log('SubscriberB', event);
  },
  onErrorFn: (e) => {
    console.error(e);
  },
  onCloseFn: () => {
    console.log('close');
  },
});
const subscriberC = eventsClient.subscribe({
  channel: 'events.*',
  onDataFn: (event: EventsReceiveMessage) => {
    console.log('SubscriberC', event);
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
      .send({ channel: 'events.A;events.B', body: 'data' })
      .catch((reason) => console.error(reason));
  }
}, 2000);

setTimeout(() => {
  subscriberA.cancel();
  subscriberB.cancel();
  subscriberC.cancel();
}, 4000);
