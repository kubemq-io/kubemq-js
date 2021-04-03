import { Utils, EventsClient, Config } from '../../../src';

function main() {
  const opts: Config = {
    address: 'localhost:50000',
    clientId: Utils.uuid(),
  };
  const eventsClient = new EventsClient(opts);
  const subscriber = eventsClient.subscribe({
    channel: 'events.single',
  });
  subscriber.onEvent.on((event) => console.log(event));
  subscriber.onError.on((error) => console.error(error));
  subscriber.onStateChanged.on((state) => console.log(state));

  setTimeout(() => {
    for (let i = 0; i < 20; i++) {
      eventsClient
        .send({ channel: 'events.single',body: Utils.stringToBytes('data') })
        .catch((reason) => console.error(reason));
    }
  }, 2000);

  setTimeout(() => {
    eventsClient.close();
  }, 4000);
}

main();
