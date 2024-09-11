// src/cq/queryTypes.ts

import { BaseMessage,TypedEvent } from '../client/KubeMQClient';
import * as pb from '../protos';
import * as grpc from '@grpc/grpc-js';
import { CQClient } from './CQClient';

export interface QueriesMessage extends BaseMessage {
  timeout?: number;
  cacheKey?: string;
  cacheTTL?: number;
}

export class QueryMessageReceived {
  /**
   * Unique identifier for the received query message.
   */
  id: string;

  /**
   * The client ID from which the query message was sent.
   */
  fromClientId: string;

  /**
   * The timestamp when the query message was received.
   */
  timestamp: Date;

  /**
   * The channel from which the query message was received.
   */
  channel: string;

  /**
   * Metadata associated with the received query message.
   */
  metadata: string;

  /**
   * Body of the received query message in bytes.
   */
  body: Uint8Array | string;

  /**
   * Reply channel associated with the received query message.
   */
  replyChannel: string;

  /**
   * Tags associated with the received query message as key-value pairs.
   */
  tags: Map<string, string>;

  /**
   * Constructor to initialize the fields with default values.
   */
  constructor() {
    this.id = '';
    this.fromClientId = '';
    this.timestamp = new Date();
    this.channel = '';
    this.metadata = '';
    this.body = new Uint8Array();
    this.replyChannel = '';
    this.tags = new Map<string, string>();
  }

  /**
   * Decodes a protocol buffer request into a QueryMessageReceived instance.
   *
   * @param queryReceive The protocol buffer request to decode.
   * @return The decoded QueryMessageReceived instance.
   */
  public static decode(queryReceive: pb.kubemq.Request): QueryMessageReceived {
    const message = new QueryMessageReceived();
    message.id = queryReceive.RequestID;
    message.fromClientId = queryReceive.ClientID;
    message.timestamp = new Date();  // Instant.now() equivalent
    message.channel = queryReceive.Channel;
    message.metadata = queryReceive.Metadata;
    message.body = typeof queryReceive.Body === 'string'
      ? new TextEncoder().encode(queryReceive.Body)
      : queryReceive.Body;
    message.replyChannel = queryReceive.ReplyChannel;
    message.tags = queryReceive.Tags;

    return message;
  }
}

export class QueriesSubscriptionRequest {
  channel: string;
  group?: string;

  onReceiveEventCallback?: (event: QueryMessageReceived) => void;
  onErrorCallback?: (error: string) => void;

  observer?: grpc.ClientReadableStream<pb.kubemq.Request>;
  isReconnecting: boolean = false;  // Flag to track reconnection status

  constructor(channel: string, group?: string) {
      this.channel = channel;
      this.group = group;
  }

  validate() {
      if (!this.channel || !this.onReceiveEventCallback) {
          throw new Error('Event subscription must have a channel and onReceiveEventCallback.');
      }
  }

  encode(cqClient: CQClient): pb.kubemq.Subscribe {
      const subscribe = new pb.kubemq.Subscribe();
      subscribe.ClientID = cqClient.clientId;
      subscribe.Channel = this.channel;
      subscribe.Group = this.group || '';
      subscribe.SubscribeTypeData = pb.kubemq.Subscribe.SubscribeType.Queries;

      return subscribe;
  }

  raiseOnReceiveMessage(event: QueryMessageReceived) {
      if (this.onReceiveEventCallback) {
          this.onReceiveEventCallback(event);
      }
  }

  raiseOnError(errorMsg: string) {
      if (this.onErrorCallback) {
          this.onErrorCallback(errorMsg);
      }
  }

  cancel() {
      if (this.observer) {
          this.observer.cancel();
          console.debug('Subscription cancelled');
      }
  }

  reconnect(cqClient: CQClient, reconnectIntervalSeconds: number) {
      if (this.isReconnecting) {
          console.debug('Already reconnecting, skipping duplicate reconnection attempt');
          return;
      }

      this.isReconnecting = true;
      console.debug('Reconnection attempt will start after', reconnectIntervalSeconds, 'seconds');
      setTimeout(async () => {
          console.debug('Attempting to re-subscribe...');
          try {
              this.cancel();  // Cancel any existing subscription before re-subscribing
              await cqClient.subscribeToCommands(this);
              console.debug('Re-subscribed successfully');
              this.isReconnecting = false;  // Reset the flag on successful reconnection
          } catch (error) {
              console.error('Re-subscribe attempt failed', error);
              this.isReconnecting = false;  // Reset the flag on failure
          }
      }, reconnectIntervalSeconds * 1000);
  }
}

export interface QueriesResponse {
  id: string;
  replyChannel?: string;
  clientId: string;
  timestamp: number;
  executed: boolean;
  error: string;
  metadata?: string;
  body?: Uint8Array | string;
  tags?: Map<string, string>;
}

