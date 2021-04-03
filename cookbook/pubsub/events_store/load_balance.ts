import { Config } from '../../../src';
import {
  EventsStoreClient,
  EventsStoreReceiveMessage,
  EventStoreType,
} from '../../../src/events_store';

const optsA: Config = {
  address: 'localhost:50000',
  clientId: 'clientA',
};
const optsB: Config = {
  address: 'localhost:50000',
  clientId: 'clientB',
};
const eventsStoreClientA = new EventsStoreClient(optsA);
const eventsStoreClientB = new EventsStoreClient(optsB);
const subscriberA = eventsStoreClientA.subscribe({
  channel: 'events_store.loadbalance',
  group: 'g1',
  requestType: EventStoreType.StartFromFirst,
  onEventFn: (event: EventsStoreReceiveMessage) => {
    console.log('SubscriberA', event);
  },
  onErrorFn: (e) => {
    console.error(e);
  },
  onCloseFn: () => {
    console.log('close');
  },
});
const subscriberB = eventsStoreClientB.subscribe({
  channel: 'events_store.loadbalance',
  group: 'g1',
  requestType: EventStoreType.StartFromFirst,
  onEventFn: (event: EventsStoreReceiveMessage) => {
    console.log('SubscriberB', event);
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
    eventsStoreClientA
      .send({ channel: 'events_store.loadbalance', body: 'data' })
      .catch((reason) => console.error(reason));
  }
}, 2000);

setTimeout(() => {
  subscriberA.cancel();
  subscriberB.cancel();
}, 4000);
