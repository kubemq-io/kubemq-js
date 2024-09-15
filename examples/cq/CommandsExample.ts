import { Config, Utils, CQClient } from 'kubemq-js'

const opts: Config = {
  address: 'localhost:50000',
  clientId: 'kubeMQClientId-ts'
};
const cqClient = new CQClient(opts);

/**
 * Send Command Request
 */
async function sendCommandRequest(channelName: string) {
  for (let i = 0; i < 10; i++) {
    cqClient
      .sendCommandRequest({
        channel: channelName,
        body: Utils.stringToBytes('data'),
        timeout: 10000,
        clientId: 'commands-sender',
      })
      .catch((reason) => console.error(reason));
  }
  console.log("Command Message Send complete")
}


async function main() {
  // wait for receiver
  await new Promise((r) => setTimeout(r, 2000));
  await sendCommandRequest('my_commands_channel');
}
main();
