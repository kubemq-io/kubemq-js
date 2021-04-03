import { Config } from '../../../src';
import { Utils } from '../../../src/utils';

import {
  EventsStoreClient,
  EventsStoreReceiveMessage,
  EventStoreType,
} from '../../../src/events_store';

const opts: Config = {
  address: 'localhost:50000',
  clientId: Utils.uuid(),
};
const eventsStoreClient = new EventsStoreClient(opts);
const subscriber = eventsStoreClient.subscribe({
  channel: 'events_store.single',
  requestType: EventStoreType.StartFromFirst,
  onEventFn: (event: EventsStoreReceiveMessage) => {
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
    eventsStoreClient
      .send({ channel: 'events_store.single', body: 'data' })
      .catch((reason) => console.error(reason));
  }
}, 2000);

setTimeout(() => {
  subscriber.cancel();
}, 4000);
