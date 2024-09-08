import { BaseMessage } from '../client/KubeMQClient';
import { TypedEvent } from '../client/KubeMQClient';
import * as pb from '../protos';

export enum EventStoreType {
    EventsStoreTypeUndefined = 0,
    StartNewOnly = 1,
    StartFromFirst = 2,
    StartFromLast = 3,
    StartAtSequence = 4,
    StartAtTime = 5,
    StartAtTimeDelta = 6
}

export interface EventsReceiveMessageCallback {
    (err: Error | null, msg: EventsReceiveMessage): void;
}

/** events stream callback */
export interface EventsStreamCallback {
    (err: Error | null, result: EventsSendResult): void;
}

/** events requests subscription response*/
export interface EventsStreamResponse {
    /** emit events on close stream*/
    onClose: TypedEvent<void>;
  
    /** write events to stream*/
    write(msg: EventsMessage): void;
  
    /** end events stream*/
    end(): void;
}

export interface EventsMessage extends BaseMessage {}

export interface EventsStoreMessage extends BaseMessage {}

export interface EventsReceiveMessage {
    id: string;
    channel: string;
    metadata: string;
    body: Uint8Array | string;
    tags: Map<string, string>;
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
  

// export interface EventsStoreSendResult {
//     id: string;
//     sent: boolean;
//     error: string;
// }

export interface EventsSubscriptionRequest {
    channel: string;
    group?: string;
    clientId?: string;
}
  
export interface EventsSubscriptionResponse {
  onState: TypedEvent<string>;
  unsubscribe(): void;
}

export interface EventsStoreReceiveMessage {
    id: string;
    channel: string;
    metadata: string;
    body: Uint8Array | string;
    tags: Map<string, string>;
    timestamp: number;
    sequence: number;
}


export interface EventsStoreSubscriptionRequest {
    channel: string;
    group?: string;
    clientId?: string;
    requestType: EventStoreType;
    requestTypeValue?: number;
}

export interface EventsStoreSubscriptionResponse {
    onState: TypedEvent<string>;
    unsubscribe(): void;
}

/** events store subscription callback */
export interface EventsStoreReceiveMessageCallback {
    (err: Error | null, msg: EventsStoreReceiveMessage): void;
}

/** events store stream callback */
// export interface EventsStoreStreamCallback {
//     (err: Error | null, result: EventsStoreSendResult): void;
// }

/** events requests subscription response*/
// export interface EventsStoreStreamResponse {
//     /** emit events on close stream*/
//     onClose: TypedEvent<void>;
  
//     /** write events store to stream*/
//     write(msg: EventsStoreMessage): void;
  
//     /** end events store stream*/
//     end(): void;
// }