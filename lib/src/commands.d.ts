import { BaseMessage, Client, StreamState } from './client';
import { Config } from './config';
import { TypedEvent } from './common';
import { Empty } from './protos';
export interface CommandsMessage extends BaseMessage {
    timeout?: number;
}
export interface CommandsReceiveMessage {
    id: string;
    channel: string;
    metadata: string;
    body: Uint8Array | string;
    tags: Map<string, string>;
    replyChannel: string;
}
export interface CommandsResponse {
    id: string;
    replyChannel?: string;
    clientId: string;
    timestamp: number;
    executed: boolean;
    error: string;
}
export interface CommandsSubscriptionRequest {
    channel: string;
    group?: string;
    clientId?: string;
}
export interface CommandsSubscriptionResponse {
    state: StreamState;
    onCommand: TypedEvent<CommandsReceiveMessage>;
    onError: TypedEvent<Error>;
    onStateChanged: TypedEvent<StreamState>;
    cancel(): void;
}
export declare class CommandsClient extends Client {
    constructor(Options: Config);
    send(message: CommandsMessage): Promise<CommandsResponse>;
    response(message: CommandsResponse): Promise<Empty>;
    subscribe(request: CommandsSubscriptionRequest): CommandsSubscriptionResponse;
}
//# sourceMappingURL=commands.d.ts.map