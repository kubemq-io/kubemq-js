import { BaseMessage, Client, StreamState } from './client';
import { Config } from './config';
import { TypedEvent } from './common';
import { Empty } from './protos';
export interface QueriesMessage extends BaseMessage {
    timeout?: number;
    cacheKey?: string;
    cacheTTL?: number;
}
export interface QueriesReceiveMessage {
    id: string;
    channel: string;
    metadata: string;
    body: Uint8Array | string;
    tags: Map<string, string>;
    replyChannel: string;
}
export interface QueriesResponse {
    id: string;
    replyChannel?: string;
    clientId: string;
    metadata?: string;
    body?: Uint8Array | string;
    tags?: Map<string, string>;
    timestamp: number;
    executed: boolean;
    error: string;
}
export interface QueriesSubscriptionRequest {
    channel: string;
    group?: string;
    clientId?: string;
}
export interface QueriesSubscriptionResponse {
    state: StreamState;
    onQuery: TypedEvent<QueriesReceiveMessage>;
    onError: TypedEvent<Error>;
    onStateChanged: TypedEvent<StreamState>;
    cancel(): void;
}
export declare class QueriesClient extends Client {
    constructor(Options: Config);
    send(message: QueriesMessage): Promise<QueriesResponse>;
    response(message: QueriesResponse): Promise<Empty>;
    subscribe(request: QueriesSubscriptionRequest): QueriesSubscriptionResponse;
}
//# sourceMappingURL=queries.d.ts.map