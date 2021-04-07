import { Utils, EventsClient, Config } from '../../../src';

async function main() {
  const opts: Config = {
    address: 'localhost:50000',
    clientId: Utils.uuid(),
  };
  const eventsClient = new EventsClient(opts);
  const subRequest = {
    channel: 'events.single',
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
  await eventsClient.send({
    channel: 'events.single',
    body: Utils.stringToBytes('event message'),
  });
}
main();
