import { Config, Utils, QueriesClient } from '../../../src';

const opts: Config = {
  address: 'localhost:50000',
  clientId: Utils.uuid(),
  reconnectInterval: 1000,
};
const queriesClient = new QueriesClient(opts);
async function sender() {
  for (let i = 0; i < 10; i++) {
    queriesClient
      .send({
        channel: 'queries',
        body: Utils.stringToBytes('data'),
        timeout: 10000,
        clientId: 'queries-sender',
      })
      .catch((reason) => console.error(reason));
  }
}
async function receiver() {
  const cb = (err: Error, msg) => {
    if (err) {
      console.error(err);
      return;
    }
    if (msg) {
      console.log(msg);
      queriesClient
        .response({
          executed: true,
          error: '',
          replyChannel: msg.replyChannel,
          clientId: 'query-response',
          timestamp: Date.now(),
          id: msg.id,
          metadata: 'some metadata',
          body: Utils.stringToBytes('Im here'),
        })
        .catch((reason) => console.log(reason));
    }
  };
  queriesClient
    .subscribe(
      {
        channel: 'queries',
      },
      cb,
    )
    .then(async (value) => {
      value.onState.on((event) => {
        console.log(event);
      });
      await new Promise((r) => setTimeout(r, 1000000));
      value.unsubscribe();
    })
    .catch((reason) => {
      console.log(reason);
    });
}

async function main() {
  await receiver();
  // wait for receiver
  await new Promise((r) => setTimeout(r, 2000));
  await sender();
}
main();
