import { Utils, EventsClient, Config } from '../../../src';

function main() {
  const opts: Config = {
    address: 'localhost:50000',
    clientId: Utils.uuid(),
  };
  const eventsClient = new EventsClient(opts);

  eventsClient
    .subscribe({
      channel: 'events.single',
    })
    .then((subscriber) => {
      subscriber.onEvent.on((event) => console.log(event));
      subscriber.onError.on((error) => console.error(error));
      subscriber.onStateChanged.on((state) => console.log(state));
    })
    .catch((reason) => console.log(reason));

  setTimeout(() => {
    for (let i = 0; i < 20; i++) {
      eventsClient
        .send({ channel: 'events.single', body: Utils.stringToBytes('data') })
        .catch((reason) => console.error(reason));
    }
  }, 2000);

  setTimeout(() => {
    eventsClient.close();
  }, 4000);
}

main();
