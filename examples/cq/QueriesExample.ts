import { Config, Utils, CQClient } from 'kubemq-js'

const opts: Config = {
  address: 'localhost:50000',
  clientId: 'kubeMQClientId-ts'
};
const cqClient = new CQClient(opts);

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
  console.log("Queries Message Send complete")
}

async function main() {
  await new Promise((r) => setTimeout(r, 2000));
  await sendQueryRequest('my_queries_channel');
}
main();
