import { Config, Utils, CQClient, CommandsReceiveMessage } from '../../src';

const opts: Config = {
  address: 'localhost:50000',
  clientId: 'kubeMQClientId-ts',
  reconnectInterval: 1000,
};
const cqClient = new CQClient(opts);

/**
 * Subscribe to command
 */
async function subscribeToCommands(channelName: string) {

  // Consumer for handling received events
  const cb = (err: Error | null, msg: CommandsReceiveMessage) => {
    if (err) {
      console.error(err);
      return;
    }
    if (msg) {
      console.log(msg);
      cqClient
        .sendCommandResponseMessage({
          executed: true,
          error: '',
          replyChannel: msg.replyChannel,
          clientId: 'command-response',
          timestamp: Date.now(),
          id: msg.id,
        })
        .catch((reason) => console.log(reason));
    }
  };

  
  cqClient.subscribeToCommands(
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
      //value.unsubscribe();
    })
    .catch((reason) => {
      console.log(reason);
    });
}

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
}


async function main() {
  await subscribeToCommands('my_commands_channel');
  // wait for receiver
  await new Promise((r) => setTimeout(r, 2000));
  await sendCommandRequest('my_commands_channel');
}
main();
