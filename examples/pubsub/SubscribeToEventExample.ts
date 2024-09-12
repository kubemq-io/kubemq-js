import { PubsubClient, Utils, Config, EventStoreType, EventsSubscriptionRequest, EventMessageReceived } from '../../src';


const opts: Config = {
  address: 'localhost:50000',
  clientId: 'kubeMQClientId-ts',
  reconnectInterval: 1000,
};
const pubsubClient = new PubsubClient(opts);

async function subscribeToEvent() {
  //Subscribes to events from the specified channel and processes received events.
  const eventsSubscriptionRequest = new EventsSubscriptionRequest('events.A', '');

  // Define the callback for receiving events
  eventsSubscriptionRequest.onReceiveEventCallback = (event: EventMessageReceived) => {
    console.log('SubscriberA received event:', {
      id: event.id,
      fromClientId: event.fromClientId,
      timestamp: event.timestamp,
      channel: event.channel,
      metadata: event.metadata,
      body: event.body,
      tags: event.tags,
    });
  };

  // Define the callback for handling errors
  eventsSubscriptionRequest.onErrorCallback = (error: string) => {
    console.error('SubscriberA error:', error);
  };

  pubsubClient
    .subscribeToEvents(eventsSubscriptionRequest)
    .then(() => {
      console.log('Subscription successful');
    })
    .catch((reason: any) => {
      console.error('Subscription failed:', reason);
    });

}


async function main() {
  await subscribeToEvent();
}

main();
