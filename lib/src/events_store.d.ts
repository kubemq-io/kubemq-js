import { BaseMessage, Client, StreamState } from './client';
import { Config } from './config';
import { TypedEvent } from './common';
export declare enum EventStoreType {
    StartNewOnly = 1,
    StartFromFirst = 2,
    StartFromLast = 3,
    StartAtSequence = 4,
    StartAtTime = 5,
    StartAtTimeDelta = 6
}
export interface EventsStoreMessage extends BaseMessage {
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
    state: StreamState;
    onEvent: TypedEvent<EventsStoreReceiveMessage>;
    onError: TypedEvent<Error>;
    onStateChanged: TypedEvent<StreamState>;
    cancel(): void;
}
export interface EventsStoreStreamResponse {
    state: StreamState;
    onResult: TypedEvent<EventsStoreSendResult>;
    onError: TypedEvent<Error>;
    onStateChanged: TypedEvent<StreamState>;
    write(message: EventsStoreMessage): void;
    end(): void;
    cancel(): void;
}
export declare class EventsStoreClient extends Client {
    constructor(Options: Config);
    send(message: EventsStoreMessage): Promise<EventsStoreSendResult>;
    stream(): EventsStoreStreamResponse;
    subscribe(request: EventsStoreSubscriptionRequest): EventsStoreSubscriptionResponse;
}
//# sourceMappingURL=events_store.d.ts.map