import { QueriesClient, Config, Utils } from '../../../src';

function main() {
  const opts: Config = {
    address: 'localhost:50000',
    clientId: 'asd',
  };
  const queriesClient = new QueriesClient(opts);
  const subscriberA = queriesClient.subscribe({
    channel: 'queries',
    group: 'g1',
    clientId: 'query-subscriberA',
  });
  const subscriberB = queriesClient.subscribe({
    channel: 'queries',
    group: 'g1',
    clientId: 'query-subscriberB',
  });

  subscriberA.onQuery.on((query) => {
    console.log('SubscriberA', query);
    queriesClient
      .response({
        executed: true,
        error: '',
        replyChannel: query.replyChannel,
        clientId: 'query-responseA',
        timestamp: Date.now(),
        id: query.id,
        metadata: 'some getMetadata from response A',
        body: Utils.stringToBytes('A says hi'),
      })
      .catch((reason) => console.log(reason));
  });
  subscriberA.onError.on((error) => console.error('SubscriberA', error));
  subscriberA.onStateChanged.on((state) => console.log('SubscriberA', state));

  subscriberB.onQuery.on((query) => {
    console.log('SubscriberB', query);
    queriesClient
      .response({
        executed: true,
        error: '',
        replyChannel: query.replyChannel,
        clientId: 'query-responseB',
        timestamp: Date.now(),
        id: query.id,
        metadata: 'some getMetadata from response B',
        body: Utils.stringToBytes('B says, Im here too'),
      })
      .catch((reason) => console.log(reason));
  });
  subscriberB.onError.on((error) => console.error('SubscriberB', error));
  subscriberB.onStateChanged.on((state) => console.log('SubscriberB', state));

  setTimeout(() => {
    for (let i = 0; i < 20; i++) {
      queriesClient
        .send({
          channel: 'queries',
          body: Utils.stringToBytes('data'),
          timeout: 10000,
          clientId: 'query-sender',
        })
        .catch((reason) => console.error(reason));
    }
  }, 2000);
  setTimeout(() => {
    queriesClient.close();
  }, 4000);
}
main();
