import { Config, QueuesClient, Utils } from '../../src';

async function main() {

  const opts: Config = {
    address: 'localhost:50000',
    clientId: 'kubeMQClientId-ts',
  };

  const channelName = 'mytest-channel';
  const queuesClient = new QueuesClient(opts);

  //message will be delayed for 5 seconds
  await queuesClient
    .sendQueuesMessage({
      channel: channelName,
      body: Utils.stringToBytes('queue message'),
      policy: {
        delaySeconds: 5,
      },
    })
    .then((result) => console.log(result))
    .catch((reason) => console.error(reason));

  //will wait for 5 seconds - no message will be received
  await queuesClient
    .waiting({
      channel: channelName,
      maxNumberOfMessages: 1,
      waitTimeoutSeconds: 5,
    })
    .then((response) => {
      console.log('Messages received:', response.messagesReceived);
    })
    .catch((reason) => {
      console.error(reason);
    });

  // will pull after 5 seconds and we should get the message, getWaitingMessages
  await queuesClient
    .waiting({
      channel: channelName,
      maxNumberOfMessages: 1,
      waitTimeoutSeconds: 5,
    })
    .then((response) => {
      console.log('Messages received:', response.messagesReceived);
    })
    .catch((reason) => {
      console.error(reason);
    });

    //PullMessages
    await queuesClient
    .pull({
      channel: channelName,
      clientId: 'kubeMQClientId-ts',
      maxNumberOfMessages: 1,
      waitTimeoutSeconds: 10,
    })
    .then((response) => {
      response.messages.forEach((msg) => {
        console.log(msg);
      });
    })
    .catch((reason) => {
      console.error(reason);
    });
}

main();
