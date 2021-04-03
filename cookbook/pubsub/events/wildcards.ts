import { EventsClient, Utils, Config } from '../../../src';
const opts: Config = {
  address: 'localhost:50000',
  clientId: Utils.uuid(),
};
const eventsClient = new EventsClient(opts);

const subscriberA = eventsClient.subscribe({
  channel: 'events.A',
});
subscriberA.onEvent.on((event) => console.log('SubscriberA', event));
subscriberA.onError.on((error) => console.error('SubscriberA', error));
subscriberA.onStateChanged.on((state) => console.log('SubscriberA', state));

const subscriberB = eventsClient.subscribe({
  channel: 'events.B',
});
subscriberB.onEvent.on((event) => console.log('SubscriberB', event));
subscriberB.onError.on((error) => console.error('SubscriberB', error));
subscriberB.onStateChanged.on((state) => console.log('SubscriberB', state));

const subscriberC = eventsClient.subscribe({
  channel: 'events.*',
});
subscriberC.onEvent.on((event) => console.log('SubscriberC', event));
subscriberC.onError.on((error) => console.error('SubscriberC', error));
subscriberC.onStateChanged.on((state) => console.log('SubscriberC', state));
setTimeout(() => {
  for (let i = 0; i < 20; i++) {
    eventsClient
      .send({ channel: 'events.A;events.B', body: Utils.stringToBytes('data') })
      .catch((reason) => console.error(reason));
  }
}, 2000);

setTimeout(() => {
  eventsClient.close();
}, 4000);
