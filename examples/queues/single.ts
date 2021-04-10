import { Config, QueuesClient, Utils } from '../../src';

async function main() {
  const opts: Config = {
    address: 'localhost:50000',
    clientId: Utils.uuid(),
  };
  const queuesClient = new QueuesClient(opts);
  await queuesClient
    .send({
      channel: 'queues.single',
      body: Utils.stringToBytes('queue message'),
    })
    .then((result) => console.log(result))
    .catch((reason) => console.error(reason));

  queuesClient
    .subscribe(
      {
        channel: 'queues.single',
        maxNumberOfMessages: 1,
        waitTimeoutSeconds: 5,
      },
      (err, response) => {
        if (err) {
          console.log(err);
          return;
        }
        response.messages.forEach((msg) => {
          console.log(msg);
        });
      },
    )
    .then(async (resp) => {
      await new Promise((r) => setTimeout(r, 500000));
      resp.unsubscribe();
    });
}

main();
