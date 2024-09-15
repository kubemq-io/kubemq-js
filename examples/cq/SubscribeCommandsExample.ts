import { Config, Utils, CQClient, CommandsSubscriptionRequest, CommandMessageReceived } from 'kubemq-js'

const opts: Config = {
  address: 'localhost:50000',
  clientId: 'kubeMQClientId-ts'
};
const cqClient = new CQClient(opts);

/**
 * Subscribe to command
 */
async function subscribeToCommands(channelName: string) {

  //Subscribes to commands from the specified channel with a specific configuration.
  const commandSubscriptionRequest = new CommandsSubscriptionRequest(channelName, 'group1');

  // Define the callback for receiving commandMessage
  commandSubscriptionRequest.onReceiveEventCallback = (commandMessage: CommandMessageReceived) => {
      console.log('SubscriberA received commandMessage:', {
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
  
  cqClient.subscribeToCommands(commandSubscriptionRequest)
      .then(() => {
          console.log('Command Subscription successful');
      })
      .catch((reason: any) => {
          console.error('Command Subscription failed:', reason);
      });
}


async function main() {
  await subscribeToCommands('my_commands_channel');
}
main();
