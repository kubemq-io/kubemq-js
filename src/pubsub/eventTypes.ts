import { BaseMessage } from '../client/KubeMQClient';
import { TypedEvent } from '../client/KubeMQClient';

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

export interface EventsSendResult {
    id: string;
    sent: boolean;
}

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

export interface EventsStoreSendResult {
    id: string;
    sent: boolean;
    error: string;
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
export interface EventsStoreStreamCallback {
    (err: Error | null, result: EventsStoreSendResult): void;
}

/** events requests subscription response*/
export interface EventsStoreStreamResponse {
    /** emit events on close stream*/
    onClose: TypedEvent<void>;
  
    /** write events store to stream*/
    write(msg: EventsStoreMessage): void;
  
    /** end events store stream*/
    end(): void;
}