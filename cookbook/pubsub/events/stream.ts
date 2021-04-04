import { EventsClient, Utils, Config } from '../../../src';

const opts: Config = {
  address: 'localhost:50000',
  clientId: Utils.uuid(),
};
const eventsClient = new EventsClient(opts);

(async () => {
  await eventsClient
    .subscribe({
      channel: 'events.stream',
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

  setTimeout(() => {
    eventsClient
      .stream()
      .then((streamer) => {
        streamer.onResult.on((result) => console.log(result));
        streamer.onError.on((error) => console.error(error));
        streamer.onStateChanged.on((state) => console.log(state));
        for (let i = 0; i < 10; i++) {
          streamer
            .write({
              channel: 'events.stream',
              body: Utils.stringToBytes('data'),
            })
            .then((value) => {
              console.log(value, 'sent');
            })
            .catch((reason) => console.log(reason));
        }
      })
      .catch((reason) => {
        console.log(reason);
      });
  }, 2000);
})();

setTimeout(() => {
  eventsClient.close();
}, 4000);
