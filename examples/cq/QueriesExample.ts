import { Config, Utils, CQClient } from '../../src';

const opts: Config = {
  address: 'localhost:50000',
  clientId: 'kubeMQClientId-ts',
  reconnectInterval: 1000,
};
const cqClient = new CQClient(opts);

/**
 * Subscribe to queries
 */
async function subscribeToQueries(channelName: string) {

  // Consumer for handling received events
  const cb = (err: Error | null, msg) => {
    if (err) {
      console.error(err);
      return;
    }
    if (msg) {
      console.log(msg);
      cqClient
        .sendQueryResponseMessage({
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

  cqClient.subscribeToQueries(
      {
        channel: channelName,
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

/**
 * Send query request
 */
async function sendQueryRequest(channelName: string) {
  for (let i = 0; i < 10; i++) {
    cqClient
      .sendQueryRequest({
        channel: channelName,
        body: Utils.stringToBytes('data'),
        timeout: 10000,
        clientId: 'queries-sender',
      })
      .catch((reason) => console.error(reason));
  }
}

async function main() {
  await subscribeToQueries('my_queries_channel');
  // wait for receiver
  await new Promise((r) => setTimeout(r, 2000));
  await sendQueryRequest('my_queries_channel');
}
main();
