import { Config, Utils, CommandsClient, CommandsReceiveMessage } from '../../../src';

const opts: Config = {
  address: 'localhost:50000',
  clientId: Utils.uuid(),
  reconnectInterval: 1000,
};
const commandsClient = new CommandsClient(opts);

async function sender() {
  for (let i = 0; i < 10; i++) {
    commandsClient
      .send({
        channel: 'commands',
        body: Utils.stringToBytes('data'),
        timeout: 10000,
        clientId: 'commands-sender',
      })
      .catch((reason) => console.error(reason));
  }
}

async function receiver() {
  const cb = (err: Error | null, msg: CommandsReceiveMessage) => {
    if (err) {
      console.error(err);
      return;
    }
    if (msg) {
      console.log(msg);
      commandsClient
        .response({
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
  commandsClient
    .subscribe(
      {
        channel: 'commands',
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
