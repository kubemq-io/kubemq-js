import { Config } from './config';
import * as kubemq from './protos';
import * as grpc from '@grpc/grpc-js';
export declare enum StreamState {
    Initialized = 0,
    Ready = 1,
    Error = 2,
    Closed = 3
}
export interface ServerInfo {
    host: string;
    version: string;
    serverStartTime: number;
    serverUpTimeSeconds: number;
}
export interface BaseMessage {
    id?: string;
    channel?: string;
    clientId?: string;
    metadata?: string;
    body?: Uint8Array;
    tags?: Map<string, string>;
}
export declare class Client {
    protected clientOptions: Config;
    protected grpcClient: kubemq.kubemqClient;
    constructor(Options: Config);
    private init;
    protected metadata(): grpc.Metadata;
    protected callOptions(): grpc.CallOptions;
    private getChannelCredentials;
    ping(): Promise<ServerInfo>;
    close(): void;
}
//# sourceMappingURL=client.d.ts.map