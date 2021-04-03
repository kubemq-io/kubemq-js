import { BaseMessage, Client, StreamState } from './client';
import { Config } from './config';
import { TypedEvent } from './common';
export interface EventsMessage extends BaseMessage {
}
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
    state: StreamState;
    onEvent: TypedEvent<EventsReceiveMessage>;
    onError: TypedEvent<Error>;
    onStateChanged: TypedEvent<StreamState>;
    cancel(): void;
}
export interface EventsStreamResponse {
    state: StreamState;
    onResult: TypedEvent<EventsSendResult>;
    onError: TypedEvent<Error>;
    onStateChanged: TypedEvent<StreamState>;
    write(message: EventsMessage): void;
    end(): void;
    cancel(): void;
}
export declare class EventsClient extends Client {
    constructor(Options: Config);
    send(message: EventsMessage): Promise<EventsSendResult>;
    stream(): EventsStreamResponse;
    subscribe(request: EventsSubscriptionRequest): EventsSubscriptionResponse;
}
//# sourceMappingURL=events.d.ts.map