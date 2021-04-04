import { EventsClient, Config, Utils } from '../../../src';

const opts: Config = {
  address: 'localhost:50000',
  clientId: Utils.uuid(),
};
const eventsClient = new EventsClient(opts);
(async () => {
  await eventsClient
    .subscribe({
      channel: 'events.loadbalance',
      group: 'g1',
    })
    .then((subscriber) => {
      subscriber.onEvent.on((event) => console.log('SubscriberA', event));
      subscriber.onError.on((error) => {
        console.error('SubscriberA', error);
      });
      subscriber.onStateChanged.on((state) =>
        console.log('SubscriberA', state),
      );
    })
    .catch((reason) => {
      console.log(reason);
    });
})();

(async () => {
  await eventsClient
    .subscribe({
      channel: 'events.loadbalance',
      group: 'g1',
    })
    .then((subscriber) => {
      subscriber.onEvent.on((event) => console.log('SubscriberB', event));
      subscriber.onError.on((error) => {
        console.error('SubscriberB', error);
      });
      subscriber.onStateChanged.on((state) =>
        console.log('SubscriberB', state),
      );
    })
    .catch((reason) => {
      console.log(reason);
    });
})();
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
