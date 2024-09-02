import { KubeMQClient, TypedEvent } from '../client/KubeMQClient';
import { Config } from '../client/config';
import * as pb from '../protos';
import { Utils } from '../common/utils';
import * as grpc from '@grpc/grpc-js';
import { createChannel, deleteChannel, listPubSubChannels } from '../common/common';
import { PubSubChannel } from '../common/channel_stats';
import {
    EventsMessage,
    EventsReceiveMessageCallback,
    EventsStreamCallback,
    EventsSendResult,
    EventsSubscriptionRequest,
    EventsSubscriptionResponse,
    EventsStreamResponse,
    EventsStoreMessage,
    EventsStoreSendResult,
    EventsStoreReceiveMessageCallback,
    EventsStoreStreamCallback,
    EventsStoreSubscriptionRequest,
    EventsStoreStreamResponse,
    EventsStoreSubscriptionResponse,
    EventStoreType,
} from './eventTypes';

/** events subscription response*/
interface internalEventsSubscriptionResponse {
    /** emit events on close subscription*/
    onClose: TypedEvent<void>;
  
    /** call stream*/
    stream: grpc.ClientReadableStream<pb.kubemq.EventReceive>;
}

  /** events subscription response*/
interface internalEventsStoreSubscriptionResponse {
    /** emit events on close subscription*/
    onClose: TypedEvent<void>;
  
    /** call stream*/
    stream: grpc.ClientReadableStream<pb.kubemq.EventReceive>;
  }

/**
 * Events Client - KubeMQ events client
 */
export class EventsClient extends KubeMQClient {
    /**
     * @internal
     */
    constructor(Options: Config) {
        super(Options);
    }

    /**
     * Send single event
     * @param msg
     * @return Promise<EventsSendResult>
     */
    send(msg: EventsMessage): Promise<EventsSendResult> {
        const pbMessage = new pb.kubemq.Event();
        pbMessage.EventID=(msg.id ? msg.id : Utils.uuid());
        pbMessage.ClientID=(msg.clientId ? msg.clientId : this.clientId);
        pbMessage.Channel=(msg.channel);
        //pbMessage.setBody(msg.body);
        // Convert the string to Uint8Array
        pbMessage.Body = typeof msg.body === 'string' ? new TextEncoder().encode(msg.body) : msg.body;
        pbMessage.Metadata=(msg.metadata);
        if (msg.tags != null) {
            pbMessage.Tags = msg.tags;
        }
        pbMessage.Store=(false);
        return new Promise<EventsSendResult>((resolve, reject) => {
            this.grpcClient.sendEvent(
                pbMessage,
                this.getMetadata(),
                this.callOptions(),
                (e) => {
                    if (e) {
                        reject(e);
                        return;
                    }
                    resolve({ id: pbMessage.EventID, sent: true });
                },
            );
        });
    }

    /**
     * Send stream of events
     * @return Promise<EventsStreamResponse>
     * @param cb
     */
    public stream(cb: EventsStreamCallback): Promise<EventsStreamResponse> {
        return new Promise<EventsStreamResponse>((resolve, reject) => {
            if (!cb) {
                reject(new Error('stream events call requires a callback'));
                return;
            }
            const stream = this.grpcClient.sendEventsStream(this.getMetadata());
            stream.on('error', (e: Error) => {
                cb(e, null);
            });
            let onCloseEvent = new TypedEvent<void>();
            stream.on('close', () => {
                onCloseEvent.emit();
            });

            const writeFn = (msg: EventsMessage) => {
                const pbMessage = new pb.kubemq.Event();
                pbMessage.EventID=(msg.id ? msg.id : Utils.uuid());
                pbMessage.ClientID=( msg.clientId ? msg.clientId : this.clientId);
                pbMessage.Channel=(msg.channel);
                //pbMessage.setBody(msg.body);
                pbMessage.Body = typeof msg.body === 'string' ? new TextEncoder().encode(msg.body) : msg.body;
                pbMessage.Metadata = msg.metadata;
               // pbMessage.setMetadata(msg.metadata);
                if (msg.tags != null) {
                    pbMessage.Tags = msg.tags;
                }
                pbMessage.Store=(false);
                const sent = stream.write(pbMessage, (err: Error) => {
                    cb(err, null);
                });
                cb(null, {
                    id: pbMessage.EventID,
                    sent: sent,
                });
            };
            resolve({
                onClose: onCloseEvent,
                write: writeFn,
                end(): void {
                    stream.end();
                },
            });
        });
    }

    /**
     * Subscribe to events messages
     * @param request
     * @param cb
     * @return Promise<EventsSubscriptionResponse>
     */
    async subscribe(
        request: EventsSubscriptionRequest,
        cb: EventsReceiveMessageCallback,
    ): Promise<EventsSubscriptionResponse> {
        return new Promise<EventsSubscriptionResponse>(async (resolve, reject) => {
            if (!request) {
                reject(new Error('events subscription requires a request object'));
                return;
            }
            if (request.channel === '') {
                reject(
                    new Error('events subscription requires a non empty request channel'),
                );
                return;
            }
            if (!cb) {
                reject(new Error('events subscription requires a callback'));
                return;
            }
            let isClosed = false;
            let unsubscribe = false;
            const onStateChange = new TypedEvent<string>();
            onStateChange.on((event) => {
                if (event === 'close') {
                    isClosed = true;
                    onStateChange.emit('disconnected');
                }
            });
            resolve({
                onState: onStateChange,
                unsubscribe() {
                    unsubscribe = true;
                },
            });
            let currentStream;
            while (!unsubscribe) {
                onStateChange.emit('connecting');
                await this.subscribeFn(request, cb).then((value) => {
                    currentStream = value.stream;
                });
                isClosed = false;
                onStateChange.emit('connected');
                while (!isClosed && !unsubscribe) {
                    await new Promise((r) => setTimeout(r, 1000));
                }
                const reconnectionInterval = this.reconnectIntervalSeconds;
                if (reconnectionInterval === 0) {
                    unsubscribe = true;
                } else {
                    await new Promise((r) => setTimeout(r, reconnectionInterval));
                }
            }
            currentStream.cancel();
        });
    }

    private subscribeFn(
        request: EventsSubscriptionRequest,
        cb: EventsReceiveMessageCallback,
    ): Promise<internalEventsSubscriptionResponse> {
        return new Promise<internalEventsSubscriptionResponse>(
            (resolve, reject) => {
                if (!cb) {
                    reject(new Error('events subscription requires a callback'));
                    return;
                }
                const pbSubRequest = new pb.kubemq.Subscribe();
                pbSubRequest.ClientID=(request.clientId ? request.clientId : this.clientId);
                pbSubRequest.Group=(request.group ? request.group : '');
                pbSubRequest.Channel=(request.channel);
                pbSubRequest.SubscribeTypeData=(1);

                const stream = this.grpcClient.subscribeToEvents(
                    pbSubRequest,
                    this.getMetadata(),
                );

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
                    cb(e, null);
                });
                let onClose = new TypedEvent<void>();
                stream.on('close', () => {
                    onClose.emit();
                });
                resolve({
                    onClose: onClose,
                    stream: stream,
                });
            },
        );
    }

    /**
     * Create channel
     * @param channelName
     * @return Promise<void>
     */
    create(channelName: string): Promise<void> {
        return createChannel(
            this.grpcClient,
            this.getMetadata(),
            this.clientId,
            channelName,
            'events',
        );
    }

    /**
     * Delete commands channel
     * @param channelName
     * @return Promise<void>
     */
    delete(channelName: string): Promise<void> {
        return deleteChannel(
            this.grpcClient,
            this.getMetadata(),
            this.clientId,
            channelName,
            'events',
        );
    }

    /**
     * List events channels
     * @param search
     * @return Promise<PubSubChannel[]>
     */
    list(search: string): Promise<PubSubChannel[]> {
        return listPubSubChannels(
            this.grpcClient,
            this.getMetadata(),
            this.clientId,
            search,
            'events',
        );
    }
}

/**
 * Events Store Client - KubeMQ events store client
 */
export class EventsStoreClient extends KubeMQClient {
    /**
     * @internal
     */
    constructor(Options: Config) {
        super(Options);
    }

    /**
     * Send single event
     * @param msg
     * @return Promise<EventsStoreSendResult>
     */
    send(msg: EventsStoreMessage): Promise<EventsStoreSendResult> {
        const pbMessage = new pb.kubemq.Event();
        pbMessage.EventID=(msg.id ? msg.id : Utils.uuid());
        pbMessage.ClientID=(msg.clientId ? msg.clientId : this.clientId);
        pbMessage.Channel=(msg.channel);
        //pbMessage.setBody(msg.body);
        pbMessage.Body = typeof msg.body === 'string' ? new TextEncoder().encode(msg.body) : msg.body;
        pbMessage.Metadata=(msg.metadata);
        if (msg.tags != null) {
            pbMessage.Tags=(msg.tags);
        }
        pbMessage.Store=(true);
        return new Promise<EventsStoreSendResult>((resolve, reject) => {
            this.grpcClient.sendEvent(
                pbMessage,
                this.getMetadata(),
                this.callOptions(),
                (e, result) => {
                    if (e) {
                        reject(e);
                        return;
                    }
                    if (result != null)
                        resolve({
                            id: result.getEventid(),
                            sent: result.getSent(),
                            error: result.getError(),
                        });
                },
            );
        });
    }

    /**
     * Send stream of events store
     * @return Promise<EventsStoreStreamResponse>
     * @param cb
     */
    public stream(
        cb: EventsStoreStreamCallback,
    ): Promise<EventsStoreStreamResponse> {
        return new Promise<EventsStoreStreamResponse>((resolve, reject) => {
            if (!cb) {
                reject(new Error('stream events store call requires a callback'));
                return;
            }
            const stream = this.grpcClient.sendEventsStream(this.getMetadata());
            stream.on('error', (e: Error) => {
                cb(e, null);
            });
            let onCloseEvent = new TypedEvent<void>();
            stream.on('close', () => {
                onCloseEvent.emit();
            });

            const writeFn = (msg: EventsStoreMessage) => {
                const pbMessage = new pb.kubemq.Event();
                pbMessage.EventID=(msg.id ? msg.id : Utils.uuid());
                pbMessage.ClientID=(msg.clientId ? msg.clientId : this.clientId);
                pbMessage.Channel=(msg.channel);
                //pbMessage.setBody(msg.body);
                pbMessage.Body = typeof msg.body === 'string' ? new TextEncoder().encode(msg.body) : msg.body;
                pbMessage.Metadata=(msg.metadata);
                if (msg.tags != null) {
                    pbMessage.Tags=(msg.tags);
                }
                pbMessage.Store=(true);
                const sent = stream.write(pbMessage, (err: Error) => {
                    cb(err, null);
                });
                cb(null, {
                    id: pbMessage.EventID,
                    sent: sent,
                    error: null
                });
            };
            resolve({
                onClose: onCloseEvent,
                write: writeFn,
                end(): void {
                    stream.end();
                },
            });
        });
    }

    /**
     * Subscribe to events store messages
     * @param request
     * @param cb
     * @return Promise<EventsStoreSubscriptionResponse>
     */
    async subscribe(
        request: EventsStoreSubscriptionRequest,
        cb: EventsStoreReceiveMessageCallback,
    ): Promise<EventsStoreSubscriptionResponse> {
        return new Promise<EventsStoreSubscriptionResponse>(
            async (resolve, reject) => {
                if (!request) {
                    reject(
                        new Error('events store subscription requires a request object'),
                    );
                    return;
                }
                if (request.channel === '') {
                    reject(
                        new Error(
                            'events store subscription requires a non empty request channel',
                        ),
                    );
                    return;
                }
                if (!cb) {
                    reject(new Error('events store subscription requires a callback'));
                    return;
                }
                let isClosed = false;
                let unsubscribe = false;
                const onStateChange = new TypedEvent<string>();
                onStateChange.on((event) => {
                    if (event === 'close') {
                        isClosed = true;
                        onStateChange.emit('disconnected');
                    }
                });
                resolve({
                    onState: onStateChange,
                    unsubscribe() {
                        unsubscribe = true;
                    },
                });
                let currentStream;
                while (!unsubscribe) {
                    onStateChange.emit('connecting');
                    await this.subscribeFn(request, cb).then((value) => {
                        currentStream = value.stream;
                    });
                    isClosed = false;
                    onStateChange.emit('connected');
                    while (!isClosed && !unsubscribe) {
                        await new Promise((r) => setTimeout(r, 1000));
                    }
                    const reconnectionInterval = this.reconnectIntervalSeconds;
                    if (reconnectionInterval === 0) {
                        unsubscribe = true;
                    } else {
                        await new Promise((r) => setTimeout(r, reconnectionInterval));
                    }
                }
                currentStream.cancel();
            },
        );
    }

    private subscribeFn(
        request: EventsStoreSubscriptionRequest,
        cb: EventsStoreReceiveMessageCallback,
    ): Promise<internalEventsStoreSubscriptionResponse> {
        return new Promise<internalEventsStoreSubscriptionResponse>(
            (resolve, reject) => {
                if (!cb) {
                    reject(new Error('events store subscription requires a callback'));
                    return;
                }
                const pbSubRequest = new pb.kubemq.Subscribe();
                pbSubRequest.ClientID=(request.clientId ? request.clientId : this.clientId);
                pbSubRequest.Group=(request.group ? request.group : '');
                pbSubRequest.Channel=(request.channel);
                pbSubRequest.SubscribeTypeData=(2);
                //pbSubRequest.EventsStoreTypeData = request.requestType;
                pbSubRequest.EventsStoreTypeData = pb.kubemq.Subscribe.EventsStoreType[
                    request.requestType as unknown as keyof typeof EventStoreType as keyof typeof pb.kubemq.Subscribe.EventsStoreType
                ];
                pbSubRequest.EventsStoreTypeValue=(request.requestTypeValue);

                const stream = this.grpcClient.subscribeToEvents(
                    pbSubRequest,
                    this.getMetadata(),
                );

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
                    cb(e, null);
                });
                let onClose = new TypedEvent<void>();
                stream.on('close', () => {
                    onClose.emit();
                });
                resolve({
                    onClose: onClose,
                    stream: stream,
                });
            },
        );
    }

    /**
     * Create events store channel
     * @param channelName
     * @return Promise<void>
     */
    create(channelName: string): Promise<void> {
        return createChannel(
            this.grpcClient,
            this.getMetadata(),
            this.clientId,
            channelName,
            'events_store',
        );
    }

    /**
     * Delete events store channel
     * @param channelName
     * @return Promise<void>
     */
    delete(channelName: string): Promise<void> {
        return deleteChannel(
            this.grpcClient,
            this.getMetadata(),
            this.clientId,
            channelName,
            'events_store',
        );
    }

    /**
     * List events store channels
     * @param search
     * @return Promise<PubSubChannel[]>
     */
    list(search: string): Promise<PubSubChannel[]> {
        return listPubSubChannels(
            this.grpcClient,
            this.getMetadata(),
            this.clientId,
            search,
            'events_store',
        );
    }
}


