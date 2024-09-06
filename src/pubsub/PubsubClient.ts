import { KubeMQClient, TypedEvent } from '../client/KubeMQClient';
import * as pb from '../protos';
import { Utils } from '../common/utils';
import * as grpc from '@grpc/grpc-js';
import { createChannel, deleteChannel, listPubSubChannels } from '../common/common';
import { PubSubChannel } from '../common/channel_stats';
import {
    EventsMessage,
    EventsReceiveMessageCallback,
    EventsSendResult,
    EventsSubscriptionRequest,
    EventsSubscriptionResponse,
    EventsStoreMessage,
    EventsStoreReceiveMessageCallback,
    EventsStoreSubscriptionRequest,
    EventsStoreSubscriptionResponse,
} from './eventTypes';
import { EventStreamHelper } from './EventStreamHelper';
import { Config } from '../client/config';

interface InternalEventsSubscriptionResponse {
    onClose: TypedEvent<void>;
    stream: grpc.ClientReadableStream<pb.kubemq.EventReceive>;
}

interface InternalEventsStoreSubscriptionResponse {
    onClose: TypedEvent<void>;
    stream: grpc.ClientReadableStream<pb.kubemq.EventReceive>;
}

export class PubsubClient extends KubeMQClient {
    private eventStreamHelper = new EventStreamHelper();

    constructor(Options: Config) {
        super(Options);
    }

    public async sendEventsMessage(msg: EventsMessage): Promise<void> {
        const pbMessage = new pb.kubemq.Event();
        pbMessage.EventID = msg.id || Utils.uuid();
        pbMessage.ClientID = msg.clientId || this.clientId;
        pbMessage.Channel = msg.channel;
        pbMessage.Body = typeof msg.body === 'string' ? new TextEncoder().encode(msg.body) : msg.body;
        pbMessage.Metadata = msg.metadata;
        if (msg.tags != null) {
            pbMessage.Tags = msg.tags;
        }
        pbMessage.Store = false;

        try {
            await this.eventStreamHelper.sendEventMessage(this, pbMessage);
        } catch (error) {
            console.error('Error sending event message:', error);
            throw error;
        }
    }

    public async sendEventStoreMessage(msg: EventsStoreMessage): Promise<EventsSendResult> {
        const pbMessage = new pb.kubemq.Event();
        pbMessage.EventID = msg.id || Utils.uuid();
        pbMessage.ClientID = msg.clientId || this.clientId;
        pbMessage.Channel = msg.channel;
        pbMessage.Body = typeof msg.body === 'string' ? new TextEncoder().encode(msg.body) : msg.body;
        pbMessage.Metadata = msg.metadata;
        if (msg.tags != null) {
            pbMessage.Tags = msg.tags;
        }
        pbMessage.Store = true;

        try {
            return await this.eventStreamHelper.sendEventStoreMessage(this, pbMessage);
        } catch (error) {
            console.error('Error sending event store message:', error);
            throw error;
        }
    }

    public async subscribeToEvents(
        request: EventsSubscriptionRequest,
        cb: EventsReceiveMessageCallback,
    ): Promise<EventsSubscriptionResponse> {
        if (!request || !request.channel || !cb) {
            throw new Error('Invalid parameters for event subscription');
        }
    
        const onStateChange = new TypedEvent<string>();
        let unsubscribe = false;
        let currentStream: grpc.ClientReadableStream<pb.kubemq.EventReceive> | null = null;
    
        const connect = async () => {
            while (!unsubscribe) {
                onStateChange.emit('connecting');
                try {
                    const { stream } = await this.subscribeFnEvent(request, cb);
                    currentStream = stream;
                    onStateChange.emit('connected');
    
                    stream.on('data', (data: pb.kubemq.EventReceive) => {
                        cb(null, {
                            id: data.EventID,
                            channel: data.Channel,
                            metadata: data.Metadata,
                            body: data.Body,
                            tags: data.Tags,
                        });
                    });
    
                    stream.on('error', (e: Error) => {
                        console.error('Subscription error:', e);
                        onStateChange.emit('disconnected');
                        // Attempt to reconnect
                        if (!unsubscribe) {
                            setTimeout(connect, this.reconnectIntervalSeconds * 1000);
                        }
                    });
    
                    stream.on('close', () => {
                        console.log('Stream closed');
                        onStateChange.emit('disconnected');
                        // Attempt to reconnect
                        if (!unsubscribe) {
                            setTimeout(connect, this.reconnectIntervalSeconds * 1000);
                        }
                    });
    
                    // Keep the connection alive
                    while (!unsubscribe) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                } catch (error) {
                    console.error('Subscription setup failed:', error);
                    // Attempt to reconnect on setup failure
                    await new Promise(resolve => setTimeout(resolve, this.reconnectIntervalSeconds * 1000));
                }
            }
        };
    
        connect();
    
        return {
            onState: onStateChange,
            unsubscribe() {
                unsubscribe = true;
                if (currentStream) {
                    currentStream.cancel();
                }
            },
        };
    }
    

    private subscribeFnEvent(
        request: EventsSubscriptionRequest,
        cb: EventsReceiveMessageCallback,
    ): Promise<InternalEventsSubscriptionResponse> {
        return new Promise<InternalEventsSubscriptionResponse>((resolve, reject) => {
            const pbSubRequest = new pb.kubemq.Subscribe();
            pbSubRequest.ClientID = request.clientId || this.clientId;
            pbSubRequest.Group = request.group || '';
            pbSubRequest.Channel = request.channel;
            pbSubRequest.SubscribeTypeData = pb.kubemq.Subscribe.SubscribeType.Events;

            const stream = this.grpcClient.SubscribeToEvents(pbSubRequest, this.getMetadata());

            resolve({
                onClose: new TypedEvent<void>(),
                stream,
            });
        });
    }

    public async subscribeToEventsStore(
        request: EventsStoreSubscriptionRequest,
        cb: EventsStoreReceiveMessageCallback,
    ): Promise<EventsStoreSubscriptionResponse> {
        if (!request || !request.channel || !cb) {
            throw new Error('Invalid parameters for event store subscription');
        }
    
        const onStateChange = new TypedEvent<string>();
        let unsubscribe = false;
        let currentStream: grpc.ClientReadableStream<pb.kubemq.EventReceive> | null = null;
    
        const connect = async () => {
            while (!unsubscribe) {
                onStateChange.emit('connecting');
                try {
                    const { stream } = await this.subscribeFnEventStore(request, cb);
                    currentStream = stream;
                    onStateChange.emit('connected');
    
                    stream.on('data', (data: pb.kubemq.EventReceive) => {
                        cb(null, {
                            id: data.EventID,
                            channel: data.Channel,
                            metadata: data.Metadata,
                            body: data.Body,
                            tags: data.Tags,
                            timestamp: data.Timestamp,
                            sequence: data.Sequence
                        });
                    });
    
                    stream.on('error', (e: Error) => {
                        console.error('Subscription error:', e);
                        onStateChange.emit('disconnected');
                        // Attempt to reconnect
                        if (!unsubscribe) {
                            setTimeout(connect, this.reconnectIntervalSeconds * 1000);
                        }
                    });
    
                    stream.on('close', () => {
                        console.log('Stream closed');
                        onStateChange.emit('disconnected');
                        // Attempt to reconnect
                        if (!unsubscribe) {
                            setTimeout(connect, this.reconnectIntervalSeconds * 1000);
                        }
                    });
    
                    // Keep the connection alive
                    while (!unsubscribe) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                } catch (error) {
                    console.error('Subscription setup failed:', error);
                    // Attempt to reconnect on setup failure
                    await new Promise(resolve => setTimeout(resolve, this.reconnectIntervalSeconds * 1000));
                }
            }
        };
    
        connect();
    
        return {
            onState: onStateChange,
            unsubscribe() {
                unsubscribe = true;
                if (currentStream) {
                    currentStream.cancel();
                }
            },
        };
    }
    
    
    private subscribeFnEventStore(
        request: EventsStoreSubscriptionRequest,
        cb: EventsStoreReceiveMessageCallback,
    ): Promise<InternalEventsStoreSubscriptionResponse> {
        return new Promise<InternalEventsStoreSubscriptionResponse>((resolve, reject) => {
            const pbSubRequest = new pb.kubemq.Subscribe();
            pbSubRequest.ClientID = request.clientId || this.clientId;
            pbSubRequest.Group = request.group || '';
            pbSubRequest.Channel = request.channel;
            pbSubRequest.SubscribeTypeData = pb.kubemq.Subscribe.SubscribeType.EventsStore;

            const stream = this.grpcClient.SubscribeToEvents(pbSubRequest, this.getMetadata());

            resolve({
                onClose: new TypedEvent<void>(),
                stream,
            });
        });
    }

   /**
     * Create channel
     * @param channelName
     * @return Promise<void>
     */
    createEventsChannel(channelName: string): Promise<void> {
        return createChannel(
            this.grpcClient,
            this.getMetadata(),
            this.clientId,
            channelName,
            'events',
        );
    }

     /**
     * Create events store channel
     * @param channelName
     * @return Promise<void>
     */
    createEventsStoreChannel(channelName: string): Promise<void> {
        return createChannel(
            this.grpcClient,
            this.getMetadata(),
            this.clientId,
            channelName,
            'events_store',
        );
    }


    /**
     * Delete commands channel
     * @param channelName
     * @return Promise<void>
     */
    deleteEventsChannel(channelName: string): Promise<void> {
        return deleteChannel(
            this.grpcClient,
            this.getMetadata(),
            this.clientId,
            channelName,
            'events',
        );
    }

    /**
     * Delete events store channel
     * @param channelName
     * @return Promise<void>
     */
    deleteEventsStoreChannel(channelName: string): Promise<void> {
        return deleteChannel(
            this.grpcClient,
            this.getMetadata(),
            this.clientId,
            channelName,
            'events_store',
        );
    }

    /**
     * List events channels
     * @param search
     * @return Promise<PubSubChannel[]>
     */
    listEventsChannels(search: string): Promise<PubSubChannel[]> {
        return listPubSubChannels(
            this.grpcClient,
            this.getMetadata(),
            this.clientId,
            search,
            'events',
        );
    }

    /**
     * List events store channels
     * @param search
     * @return Promise<PubSubChannel[]>
     */
    listEventsStoreChannels(search: string): Promise<PubSubChannel[]> {
            return listPubSubChannels(
                this.grpcClient,
                this.getMetadata(),
                this.clientId,
                search,
                'events_store',
            );
        }

}
