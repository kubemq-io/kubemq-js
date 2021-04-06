import { EventsClient, Utils, Config } from '../../../src';

async function main() {
  const opts: Config = {
    address: 'localhost:50000',
    clientId: Utils.uuid(),
  };
  const eventsClient = new EventsClient(opts);
  const subRequest = {
    channel: 'events.stream',
  };
  await eventsClient
    .subscribe(subRequest, (err, msg) => {
      if (err) {
        console.error(err);
        return;
      }
      if (msg) {
        console.log(msg);
      }
    })
    .catch((reason) => {
      console.log(reason);
    });
  await new Promise((r) => setTimeout(r, 2000));

  const sender = eventsClient
    .stream((err, result) => {
      if (err) {
        console.error(err);
        return;
      }
      if (result) {
        console.log(result);
      }
    })
    .catch((reason) => {
      console.log(reason);
    });

  sender.then((res) => {
    if (res) {
      for (let i = 0; i < 10; i++) {
        res.write({
          channel: 'events.stream',
          body: Utils.stringToBytes('event message'),
        });
      }
    }
  });
}
main();
