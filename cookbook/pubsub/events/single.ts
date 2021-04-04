import { Utils, EventsClient, Config } from '../../../src';

const opts: Config = {
  address: 'localhost:50000',
  clientId: Utils.uuid(),
};
const eventsClient = new EventsClient(opts);
(async () => {
  await eventsClient
    .subscribe({
      channel: 'events.single',
    })
    .then((subscriber) => {
      subscriber.onEvent.on((event) => console.log(event));
      subscriber.onError.on((error) => {
        console.error(error);
      });
      subscriber.onStateChanged.on((state) => console.log(state));
    })
    .catch((reason) => {
      console.log(reason);
    });
})();

setTimeout(async () => {
  let isError: boolean = false;
  for (let i = 0; i < 10; i++) {
    await eventsClient
      .send({ channel: 'events.single', body: Utils.stringToBytes('data') })
      .catch((reason) => {
        console.error(reason);
        isError = true;
      });
    if (isError) {
      break;
    }
  }
}, 2000);

setTimeout(() => {
  eventsClient.close();
}, 4000);
