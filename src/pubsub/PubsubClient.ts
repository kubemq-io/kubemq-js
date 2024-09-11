import { KubeMQClient, TypedEvent } from '../client/KubeMQClient';
import * as pb from '../protos';
import { Utils } from '../common/utils';
import * as grpc from '@grpc/grpc-js';
import { createChannel, deleteChannel, listPubSubChannels } from '../common/common';
import { PubSubChannel } from '../common/channel_stats';
import {
    EventsMessage,
    EventsSendResult,
    EventsSubscriptionRequest,
    EventsStoreMessage,
    EventsStoreSubscriptionRequest,
    EventMessageReceived,
    EventStoreMessageReceived,
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

   // Subscribe to Events Method
   public async subscribeToEvents(request: EventsSubscriptionRequest): Promise<void> {
    try {
        console.debug('Subscribing to events');
        request.validate(); // Validate the request

        const subscribe = request.encode(this);
        const stream = this.grpcClient.SubscribeToEvents(subscribe, this.getMetadata());

        // Assign observer to the request
        request.observer = stream;

        // Event received
        stream.on('data', (data: pb.kubemq.EventReceive) => {
            console.debug(`Event received: ID='${data.EventID}', Channel='${data.Channel}'`);
            const event = EventMessageReceived.decode(data);
            request.raiseOnReceiveMessage(event); // Process received event
        });

        // Handle errors (like server being unavailable)
        stream.on('error', (err: grpc.ServiceError) => {
            console.error('Subscription error:', err.message);
            console.error('Subscription error code:', err.code);

            request.raiseOnError(err.message);

            if (err.code === grpc.status.UNAVAILABLE) {
                console.debug('Server is unavailable, attempting to reconnect...');
                request.reconnect(this, this.reconnectIntervalSeconds); // Trigger reconnection
            }
        });

        // Handle stream close
        stream.on('close', () => {
            console.debug('Stream closed by the server, attempting to reconnect...');
            request.reconnect(this, this.reconnectIntervalSeconds); // Attempt to reconnect when the stream is closed
        });
    } catch (error) {
        console.error('Failed to subscribe to events', error);
        throw new Error('Subscription failed');
    }
}


 // Subscribe to EventStore Method
 public async subscribeToEventsStore(request: EventsStoreSubscriptionRequest): Promise<void> {
    try {
        console.debug('Subscribing to events');
        request.validate(); // Validate the request

        const subscribe = request.encode(this);
        console.log(subscribe.toObject());
        const stream = this.grpcClient.SubscribeToEvents(subscribe, this.getMetadata());

        // Assign observer to the request
        request.observer = stream;

        // Event received
        stream.on('data', (data: pb.kubemq.EventReceive) => {
            console.debug(`EventStore Event received: ID='${data.EventID}', Channel='${data.Channel}'`);
            const event = EventStoreMessageReceived.decode(data);
            request.raiseOnReceiveMessage(event); // Process received event
        });

        // Handle errors (like server being unavailable)
        stream.on('error', (err: grpc.ServiceError) => {
            console.error('Subscription error:', err.message);
            console.error('Subscription error code:', err.code);

            request.raiseOnError(err.message);

            if (err.code === grpc.status.UNAVAILABLE) {
                console.debug('Server is unavailable, attempting to reconnect...');
                request.reconnect(this, this.reconnectIntervalSeconds); // Trigger reconnection
            }
        });

        // Handle stream close
        stream.on('close', () => {
            console.debug('Stream closed by the server, attempting to reconnect...');
            request.reconnect(this, this.reconnectIntervalSeconds); // Attempt to reconnect when the stream is closed
        });
    } catch (error) {
        console.error('Failed to subscribe to eventstore', error);
        throw new Error('Subscription failed');
    }
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
