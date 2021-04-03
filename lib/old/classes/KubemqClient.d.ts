import { Settings } from './Settings';
import { kubemqClient } from '../../src/protos';
import { PingResult } from './wrrappers';
import { EventResult, Event, EventsSubscriber, EventsSubscriptionRequest, EventReceive } from './Events';
export declare class KubemqClient {
    protected settings: Settings;
    protected grpcClient: kubemqClient;
    constructor(settings: Settings);
    createClient(): kubemqClient;
    close(): void;
    ping(): Promise<PingResult>;
    sendEvent(event: Event): Promise<EventResult>;
    subscribeToEvents(subRequest: EventsSubscriptionRequest, reqHandler: (eventReceive: EventReceive) => void, errorHandler: (e: any) => void, stateHandler?: (state: string) => void): EventsSubscriber;
}
//# sourceMappingURL=KubemqClient.d.ts.map