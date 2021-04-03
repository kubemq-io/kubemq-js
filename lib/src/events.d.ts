import { BaseMessage, Client } from './client';
import { Config } from './config';
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
    onEventFn?: (event: EventsReceiveMessage) => void;
    onErrorFn?: (e: Error) => void;
    onCloseFn?: () => void;
}
export interface EventsSubscriptionResponse {
    cancel(): void;
}
export interface EventsStreamRequest {
    onErrorFn?: (e: Error) => void;
    onCloseFn?: () => void;
}
export interface EventsStreamResponse {
    write(message: EventsMessage): void;
    end(): void;
    cancel(): void;
}
export declare class EventsClient extends Client {
    constructor(Options: Config);
    send(message: EventsMessage): Promise<EventsSendResult>;
    stream(request: EventsStreamRequest): EventsStreamResponse;
    subscribe(request: EventsSubscriptionRequest): EventsSubscriptionResponse;
}
//# sourceMappingURL=events.d.ts.map