import { EventsClient, Config, Utils } from '../../../src';

const opts: Config = {
  address: 'localhost:50000',
  clientId: Utils.uuid(),
};
const eventsClient = new EventsClient(opts);
const subscriberA = eventsClient.subscribe({
  channel: 'events.loadbalance',
  group: 'g1',
});
subscriberA.onEvent.on((event) => console.log('SubscriberA', event));
subscriberA.onError.on((error) => console.error('SubscriberA', error));
subscriberA.onStateChanged.on((state) => console.log('SubscriberA', state));

const subscriberB = eventsClient.subscribe({
  channel: 'events.loadbalance',
  group: 'g1',
});
subscriberB.onEvent.on((event) => console.log('SubscriberB', event));
subscriberB.onError.on((error) => console.error('SubscriberB', error));
subscriberB.onStateChanged.on((state) => console.log('SubscriberB', state));
setTimeout(() => {
  for (let i = 0; i < 20; i++) {
    eventsClient
      .send({
        channel: 'events.loadbalance',
        body: Utils.stringToBytes('data'),
      })
      .catch((reason) => console.error(reason));
  }
}, 2000);

setTimeout(() => {
  eventsClient.close();
}, 4000);
