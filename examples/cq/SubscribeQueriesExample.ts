import { Config, Utils, CQClient, CommandsSubscriptionRequest, CommandMessageReceived } from 'kubemq-js'

const opts: Config = {
  address: 'localhost:50000',
  clientId: 'kubeMQClientId-ts'
};
const cqClient = new CQClient(opts);

/**
 * Subscribe to queries
 */
async function subscribeToQueries(channelName: string) {

  //Subscribes to queries from the specified channel with a specific configuration.
  const commandSubscriptionRequest = new CommandsSubscriptionRequest(channelName, 'group1');

  // Define the callback for receiving queriesMessage
  commandSubscriptionRequest.onReceiveEventCallback = (commandMessage: CommandMessageReceived) => {
      console.log('SubscriberA received event:', {
          id: commandMessage.id,
          fromClientId: commandMessage.fromClientId,
          timestamp: commandMessage.timestamp,
          channel: commandMessage.channel,
          metadata: commandMessage.metadata,
          body: commandMessage.body,
          tags: commandMessage.tags,
      });
  };
  
  // Define the callback for handling errors
  commandSubscriptionRequest.onErrorCallback = (error: string) => {
      console.error('SubscriberA error:', error);
  };
  
  cqClient.subscribeToQueries(commandSubscriptionRequest)
      .then(() => {
          console.log('Queries Subscription successful');
      })
      .catch((reason: any) => {
          console.error('Queries Subscription failed:', reason);
      });
}


async function main() {
  await subscribeToQueries('my_queries_channel');
}
main();
