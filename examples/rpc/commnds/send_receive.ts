import { CommandsClient, Config, Utils } from '../../../src';

async function main() {
  const opts: Config = {
    address: 'localhost:50000',
    clientId: 'asd',
  };
  const commandsClient = new CommandsClient(opts);
  await commandsClient.subscribe(
    {
      channel: 'commands',
      group: 'g1',
      clientId: 'command-subscriberA',
    },
    (err, msg) => {
      if (err) {
        console.error('command-subscriberA', err);
        return;
      }
      if (msg) {
        console.log('SubscriberA', msg);
        commandsClient
          .response({
            executed: true,
            error: '',
            replyChannel: msg.replyChannel,
            clientId: 'command-responseA',
            timestamp: Date.now(),
            id: msg.id,
          })
          .catch((reason) => console.log(reason));
      }
    },
  );
  await commandsClient.subscribe(
    {
      channel: 'commands',
      group: 'g1',
      clientId: 'command-subscriberB',
    },
    (err, msg) => {
      if (err) {
        console.error('command-subscriberB', err);
        return;
      }
      if (msg) {
        console.log('SubscriberB', msg);
        commandsClient
          .response({
            executed: true,
            error: '',
            replyChannel: msg.replyChannel,
            clientId: 'command-responseB',
            timestamp: Date.now(),
            id: msg.id,
          })
          .catch((reason) => console.log(reason));
      }
    },
  );
  await new Promise((r) => setTimeout(r, 2000));
  for (let i = 0; i < 10; i++) {
    commandsClient
      .send({
        channel: 'commands',
        body: Utils.stringToBytes('data'),
        timeout: 10000,
        clientId: 'command-sender',
      })
      .catch((reason) => console.error(reason));
  }
}
main();
