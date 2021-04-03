import { CommandsClient, Config, Utils } from '../../../src';

function main() {
  const opts: Config = {
    address: 'localhost:50000',
    clientId: 'asd',
  };
  const commandsClient = new CommandsClient(opts);
  const subscriberA = commandsClient.subscribe({
    channel: 'commands',
    group: 'g1',
    clientId: 'command-subscriberA',
  });
  const subscriberB = commandsClient.subscribe({
    channel: 'commands',
    group: 'g1',
    clientId: 'command-subscriberB',
  });

  subscriberA.onCommand.on((command) => {
    console.log('SubscriberA', command);
    commandsClient
      .response({
        executed: true,
        error: '',
        replyChannel: command.replyChannel,
        clientId: 'command-responseA',
        timestamp: Date.now(),
        id: command.id,
      })
      .catch((reason) => console.log(reason));
  });
  subscriberA.onError.on((error) => console.error('SubscriberA', error));
  subscriberA.onStateChanged.on((state) => console.log('SubscriberA', state));

  subscriberB.onCommand.on((command) => {
    console.log('SubscriberB', command);
    commandsClient
      .response({
        executed: true,
        error: '',
        replyChannel: command.replyChannel,
        clientId: 'command-responseB',
        timestamp: Date.now(),
        id: command.id,
      })
      .catch((reason) => console.log(reason));
  });
  subscriberB.onError.on((error) => console.error('SubscriberB', error));
  subscriberB.onStateChanged.on((state) => console.log('SubscriberB', state));

  setTimeout(() => {
    for (let i = 0; i < 20; i++) {
      commandsClient
        .send({
          channel: 'commands',
          body: Utils.stringToBytes('data'),
          timeout: 10000,
          clientId: 'command-sender',
        })
        .catch((reason) => console.error(reason));
    }
  }, 2000);
  setTimeout(() => {
    commandsClient.close();
  }, 4000);
}
main();
