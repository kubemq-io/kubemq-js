import { Config, PubsubClient, EventStoreType,  EventsStoreSubscriptionRequest, EventStoreMessageReceived } from 'kubemq-js'

const opts: Config = {
  address: 'localhost:50000',
  clientId: 'kubeMQClientId-ts'
};
const pubsubClient = new PubsubClient(opts);

async function subscribeToEventStore() {
  //Subscribes to events store messages from the specified channel with a specific configuration.
  const eventsSubscriptionRequest = new EventsStoreSubscriptionRequest('events_store.A', '');
  eventsSubscriptionRequest.eventsStoreType = EventStoreType.StartAtSequence;
  eventsSubscriptionRequest.eventsStoreSequenceValue=1;

  // Define the callback for receiving events
  eventsSubscriptionRequest.onReceiveEventCallback = (event: EventStoreMessageReceived) => {
    console.log('SubscriberA received event:', {
      id: event.id,
      fromClientId: event.fromClientId,
      timestamp: event.timestamp,
      channel: event.channel,
      metadata: event.metadata,
      body: event.body,
      tags: event.tags,
      sequence: event.sequence,
    });
  };

  // Define the callback for handling errors
  eventsSubscriptionRequest.onErrorCallback = (error: string) => {
    console.error('SubscriberA error:', error);
  };

  pubsubClient
    .subscribeToEvents(eventsSubscriptionRequest)
    .then(() => {
      console.log('Eventstore Subscription successful');
    })
    .catch((reason: any) => {
      console.error('Eventstore Subscription failed:', reason);
    });
}

async function main() {
 await subscribeToEventStore();
}

main();
