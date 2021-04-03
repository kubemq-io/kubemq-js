import { Validator } from '../interfaces';
import * as pb from '../../src/protos';
import { ClientReadableStream } from '@grpc/grpc-js';
export declare class Event implements Validator {
    id: string;
    channel: string;
    metadata: string;
    body: Uint8Array | string;
    clientId: string;
    tags: Map<string, string>;
    setId(value: string): Event;
    setChannel(value: string): Event;
    setMetadata(value: string): Event;
    setBody(value: Uint8Array | string): Event;
    setClientId(value: string): Event;
    setTags(value: Map<string, string>): Event;
    constructor();
    toPB(): pb.Event;
    validate(): boolean | string;
}
export declare class EventResult {
    readonly sent: boolean;
    readonly id: string;
    constructor(id: string);
}
export declare class EventReceive {
    protected ev: pb.EventReceive;
    readonly id: string;
    readonly channel: string;
    readonly metadata: string;
    readonly body: Uint8Array | string;
    readonly tags: Map<string, string>;
    constructor(ev: pb.EventReceive);
}
export declare class EventsSubscriptionRequest {
    channel: string;
    group: string;
    clientId?: string;
    setClientId(value: string): EventsSubscriptionRequest;
    toPB(clientId: string): pb.Subscribe;
    constructor(channel: string, group: string, clientId?: string);
}
export declare class EventsSubscriber {
    stream?: ClientReadableStream<pb.EventReceive>;
    state: string;
    setState(value: string): void;
    constructor();
    stop(): void;
}
//# sourceMappingURL=Events.d.ts.map