import { Config, Utils, QueriesClient } from '../../../src';

async function main() {
  const opts: Config = {
    address: 'localhost:50000',
    clientId: 'asd',
  };
  const queriesClient = new QueriesClient(opts);
  await queriesClient.subscribe(
    {
      channel: 'queries',
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
        queriesClient
          .response({
            executed: true,
            error: '',
            replyChannel: msg.replyChannel,
            clientId: 'command-responseA',
            timestamp: Date.now(),
            id: msg.id,
            metadata: 'some getMetadata from response A',
            body: Utils.stringToBytes('A says hi'),
          })
          .catch((reason) => console.log(reason));
      }
    },
  );
  await queriesClient.subscribe(
    {
      channel: 'queries',
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
        queriesClient
          .response({
            executed: true,
            error: '',
            replyChannel: msg.replyChannel,
            clientId: 'command-responseB',
            timestamp: Date.now(),
            id: msg.id,
            metadata: 'some getMetadata from response B',
            body: Utils.stringToBytes('B says, Im here too'),
          })
          .catch((reason) => console.log(reason));
      }
    },
  );
  await new Promise((r) => setTimeout(r, 2000));
  for (let i = 0; i < 10; i++) {
    queriesClient
      .send({
        channel: 'queries',
        body: Utils.stringToBytes('data'),
        timeout: 10000,
        clientId: 'command-sender',
      })
      .catch((reason) => console.error(reason));
  }
}
main();
