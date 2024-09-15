import { BaseMessage } from '../client/KubeMQClient';
import { TypedEvent } from '../client/KubeMQClient';
import * as pb from '../protos';
import * as grpc from '@grpc/grpc-js';
import { PubsubClient } from '../pubsub/PubsubClient';

export enum EventStoreType {
    EventsStoreTypeUndefined = 0,
    StartNewOnly = 1,
    StartFromFirst = 2,
    StartFromLast = 3,
    StartAtSequence = 4,
    StartAtTime = 5,
    StartAtTimeDelta = 6
}


export interface EventsMessage extends BaseMessage {}

export interface EventsStoreMessage extends BaseMessage {}

export class EventMessageReceived {
  /**
   * Unique identifier for the received event message.
   */
  id: string;

  /**
   * The client ID from which the event message was sent.
   */
  fromClientId: string;

  /**
   * The timestamp when the event message was received.
   */
  timestamp: Date;

  /**
   * The channel from which the event message was received.
   */
  channel: string;

  /**
   * Metadata associated with the received event message.
   */
  metadata: string;

  /**
   * Body of the received event message in bytes.
   */
  body: Uint8Array | string;

  /**
   * Tags associated with the received event message as key-value pairs.
   */
  tags: Map<string, string>;

  /**
   * Constructor to initialize the fields.
   */
  constructor() {
      this.id = '';
      this.fromClientId = '';
      this.timestamp = new Date();
      this.channel = '';
      this.metadata = '';
      this.body = new Uint8Array();
      this.tags = new Map<string, string>();
  }

  /**
   * Decodes a KubeMQ EventReceive object into an EventMessageReceived instance.
   *
   * @param event The EventReceive object to decode.
   * @return The decoded EventMessageReceived instance.
   */
  public static decode(event: pb.kubemq.EventReceive): EventMessageReceived {
      const message = new EventMessageReceived();
      message.id = event.EventID;
      message.fromClientId = event.Tags.get("x-kubemq-client-id") || '';
      message.channel = event.Channel;
      message.metadata = event.Metadata;
      message.body = typeof event.Body === 'string' ? new TextEncoder().encode(event.Body) : event.Body;
      message.tags = event.Tags;

      return message;
  }
}


export class EventsSendResult {
    /**
     * Unique identifier for the sent event message.
     */
    public id: string;
  
    /**
     * Indicates whether the event message was successfully sent.
     */
    public sent: boolean;
  
    /**
     * Error message if the event message was not sent successfully.
     */
    public error: string;
  
    constructor(id: string = '', sent: boolean = false, error: string = '') {
      this.id = id;
      this.sent = sent;
      this.error = error;
    }
  
    /**
     * Decodes a KubeMQ Result object into an EventSendResult instance.
     *
     * @param result The KubeMQ Result object to decode.
     * @returns The decoded EventSendResult instance.
     */
    public static decode(result: pb.kubemq.Result): EventsSendResult {
      return new EventsSendResult(
        result.EventID,
        result.Sent,
        result.Error
      );
    }
  
    /**
     * Returns a string representation of the event send result.
     *
     * @returns A string containing the event send result details.
     */
    public toString(): string {
      return `EventSendResult: id=${this.id}, sent=${this.sent}, error=${this.error}`;
    }
  }
  


export class EventsSubscriptionRequest {
  channel: string;
  group?: string;

  onReceiveEventCallback?: (event: EventMessageReceived) => void;
  onErrorCallback?: (error: string) => void;

  observer?: grpc.ClientReadableStream<pb.kubemq.EventReceive>;
  isReconnecting: boolean = false;  // Flag to track reconnection status

  constructor(channel: string, group?: string) {
      this.channel = channel;
      this.group = group;
  }

  validate() {
      if (!this.channel || !this.onReceiveEventCallback) {
          throw new Error('Event subscription must have a channel and onReceiveEventCallback.');
      }
  }

  encode(pubSubClient: PubsubClient): pb.kubemq.Subscribe {
      const subscribe = new pb.kubemq.Subscribe();
      subscribe.ClientID = pubSubClient.clientId;
      subscribe.Channel = this.channel;
      subscribe.Group = this.group || '';
      subscribe.SubscribeTypeData = pb.kubemq.Subscribe.SubscribeType.Events;

      return subscribe;
  }

  raiseOnReceiveMessage(event: EventMessageReceived) {
      if (this.onReceiveEventCallback) {
          this.onReceiveEventCallback(event);
      }
  }

  raiseOnError(errorMsg: string) {
      if (this.onErrorCallback) {
          this.onErrorCallback(errorMsg);
      }
  }

  cancel() {
      if (this.observer) {
          this.observer.cancel();
          console.debug('Subscription cancelled');
      }
  }

  reconnect(pubSubClient: PubsubClient, reconnectIntervalSeconds: number) {
      if (this.isReconnecting) {
          console.debug('Already reconnecting, skipping duplicate reconnection attempt');
          return;
      }

      this.isReconnecting = true;
      console.debug('Reconnection attempt will start after', reconnectIntervalSeconds, 'seconds');
      setTimeout(async () => {
          console.debug('Attempting to re-subscribe...');
          try {
              this.cancel();  // Cancel any existing subscription before re-subscribing
              await pubSubClient.subscribeToEvents(this);
              console.debug('Re-subscribed successfully');
              this.isReconnecting = false;  // Reset the flag on successful reconnection
          } catch (error) {
              console.error('Re-subscribe attempt failed', error);
              this.isReconnecting = false;  // Reset the flag on failure
          }
      }, reconnectIntervalSeconds * 1000);
  }
}

  
export interface EventsSubscriptionResponse {
  onState: TypedEvent<string>;
  unsubscribe(): void;
}


export class EventStoreMessageReceived {
    /**
     * Unique identifier for the received event message.
     */
    id: string;
  
    /**
     * The client ID from which the event message was sent.
     */
    fromClientId: string;
  
    /**
     * The timestamp when the event message was received.
     */
    timestamp: Date;
  
    /**
     * The channel from which the event message was received.
     */
    channel: string;
  
    /**
     * Metadata associated with the received event message.
     */
    metadata: string;
  
    /**
     * Body of the received event message in bytes.
     */
    body: Uint8Array | string;
  
    /**
     * Tags associated with the received event message as key-value pairs.
     */
    tags: Map<string, string>;
    sequence: number;
  
    /**
     * Constructor to initialize the fields.
     */
    constructor() {
        this.id = '';
        this.fromClientId = '';
        this.timestamp = new Date();
        this.channel = '';
        this.metadata = '';
        this.body = new Uint8Array();
        this.tags = new Map<string, string>();
        this.sequence =0;
    }
  
    /**
     * Decodes a KubeMQ EventReceive object into an EventMessageReceived instance.
     *
     * @param event The EventReceive object to decode.
     * @return The decoded EventMessageReceived instance.
     */
    public static decode(event: pb.kubemq.EventReceive): EventStoreMessageReceived {
        const message = new EventStoreMessageReceived();
        message.id = event.EventID;
        message.fromClientId = event.Tags.get("x-kubemq-client-id") || '';
        message.channel = event.Channel;
        message.metadata = event.Metadata;
        message.body = typeof event.Body === 'string' ? new TextEncoder().encode(event.Body) : event.Body;
        message.tags = event.Tags;
        message.sequence = event.Sequence;
        return message;
    }
  }

export class EventsStoreSubscriptionRequest {
    channel: string;
    group?: string;
    eventsStoreType: EventStoreType;
    eventsStoreSequenceValue?: number;
    eventsStoreStartTime?: Date;
  
    onReceiveEventCallback?: (event: EventStoreMessageReceived) => void;
    onErrorCallback?: (error: string) => void;
  
    observer?: grpc.ClientReadableStream<pb.kubemq.EventReceive>;
    isReconnecting: boolean = false;  // Flag to track reconnection status
  
    constructor(channel: string, group?: string) {
        this.channel = channel;
        this.group = group;
    }
  
    validate() {
        if (!this.channel || this.channel.trim().length === 0) {
            throw new Error("Event Store subscription must have a channel.");
        }

        if (!this.onReceiveEventCallback) {
            throw new Error("Event Store subscription must have an onReceiveEventCallback function.");
        }

        if (this.eventsStoreType == null || this.eventsStoreType === EventStoreType.EventsStoreTypeUndefined) {
            throw new Error("Event Store subscription must have an events store type.");
        }

        if (this.eventsStoreType === EventStoreType.StartAtSequence && !this.eventsStoreSequenceValue) {
            throw new Error("Event Store subscription with StartAtSequence events store type must have a sequence value.");
        }

        if (this.eventsStoreType === EventStoreType.StartAtTime && !this.eventsStoreStartTime) {
            throw new Error("Event Store subscription with StartAtTime events store type must have a start time.");
        }
    }
  
    encode(pubSubClient: PubsubClient): pb.kubemq.Subscribe {
        const subscribe = new pb.kubemq.Subscribe();
        subscribe.ClientID = pubSubClient.clientId;
        subscribe.Channel = this.channel;
        subscribe.Group = this.group || '';
        subscribe.SubscribeTypeData = pb.kubemq.Subscribe.SubscribeType.EventsStore;
        subscribe.EventsStoreTypeData = this.convertToEventStoreType(this.eventsStoreType)
        subscribe.EventsStoreTypeValue = this.eventsStoreStartTime !== null && this.eventsStoreStartTime !== undefined ? Math.floor(this.eventsStoreStartTime.getTime() / 1000) : this.eventsStoreSequenceValue;
        return subscribe;
    }

    convertToEventStoreType(eventsStoreType:EventStoreType):pb.kubemq.Subscribe.EventsStoreType{
        return eventsStoreType as unknown as pb.kubemq.Subscribe.EventsStoreType;
    }
  
    raiseOnReceiveMessage(event: EventStoreMessageReceived) {
        if (this.onReceiveEventCallback) {
            this.onReceiveEventCallback(event);
        }
    }
  
    raiseOnError(errorMsg: string) {
        if (this.onErrorCallback) {
            this.onErrorCallback(errorMsg);
        }
    }
  
    cancel() {
        if (this.observer) {
            this.observer.cancel();
            console.debug('Subscription cancelled');
        }
    }
  
    reconnect(pubSubClient: PubsubClient, reconnectIntervalSeconds: number) {
        if (this.isReconnecting) {
            console.debug('Already reconnecting, skipping duplicate reconnection attempt');
            return;
        }
  
        this.isReconnecting = true;
        console.debug('Reconnection attempt will start after', reconnectIntervalSeconds, 'seconds');
        setTimeout(async () => {
            console.debug('Attempting to re-subscribe...');
            try {
                this.cancel();  // Cancel any existing subscription before re-subscribing
                await pubSubClient.subscribeToEventsStore(this);
                console.debug('Re-subscribed successfully');
                this.isReconnecting = false;  // Reset the flag on successful reconnection
            } catch (error) {
                console.error('Re-subscribe attempt failed', error);
                this.isReconnecting = false;  // Reset the flag on failure
            }
        }, reconnectIntervalSeconds * 1000);
    }
  }


