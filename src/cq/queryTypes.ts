// src/cq/queryTypes.ts

import { BaseMessage, TypedEvent } from '../client/KubeMQClient';
import * as pb from '../protos';
import * as grpc from '@grpc/grpc-js';
import { CQClient } from './CQClient';

// QueriesMessage interface extending BaseMessage
export interface QueriesMessage extends BaseMessage {
  timeout?: number;   // Optional timeout for queries
  cacheKey?: string;  // Optional cache key for the query
  cacheTTL?: number;  // Time-to-live for the cache (in seconds)
}

// QueryMessageReceived class representing a received query message
export class QueryMessageReceived {
  id: string;  // Unique identifier for the query message
  fromClientId: string;  // Client ID from which the query was sent
  timestamp: Date;  // Timestamp when the query was received
  channel: string;  // Channel through which the query was received
  metadata: string;  // Metadata associated with the query
  body: Uint8Array | string;  // Body of the query message
  replyChannel: string;  // Reply channel for the query response
  tags: Map<string, string>;  // Tags associated with the query message

  // Constructor initializing fields with default values
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
   * @returns The decoded QueryMessageReceived instance.
   */
  public static decode(queryReceive: pb.kubemq.Request): QueryMessageReceived {
    const message = new QueryMessageReceived();
    message.id = queryReceive.RequestID;
    message.fromClientId = queryReceive.ClientID;
    message.timestamp = new Date();  // Current timestamp
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

// QueriesSubscriptionRequest class to handle query subscription requests
export class QueriesSubscriptionRequest {
  channel: string;  // Channel to subscribe to for queries
  group?: string;  // Optional subscription group

  onReceiveEventCallback?: (event: QueryMessageReceived) => void;  // Callback for received query messages
  onErrorCallback?: (error: string) => void;  // Callback for handling errors

  observer?: grpc.ClientReadableStream<pb.kubemq.Request>;  // gRPC observer for the subscription
  isReconnecting: boolean = false;  // Flag indicating if reconnection is in progress

  constructor(channel: string, group?: string) {
    this.channel = channel;
    this.group = group;
  }

  /**
   * Validates the subscription request.
   * Ensures that the channel and the event callback are provided.
   */
  validate() {
    if (!this.channel || !this.onReceiveEventCallback) {
      throw new Error('Query subscription must have a channel and onReceiveEventCallback.');
    }
  }

  /**
   * Encodes the subscription request into a protocol buffer Subscribe message.
   *
   * @param cqClient The CQClient instance.
   * @returns The encoded Subscribe message.
   */
  encode(cqClient: CQClient): pb.kubemq.Subscribe {
    const subscribe = new pb.kubemq.Subscribe();
    subscribe.ClientID = cqClient.clientId;
    subscribe.Channel = this.channel;
    subscribe.Group = this.group || '';
    subscribe.SubscribeTypeData = pb.kubemq.Subscribe.SubscribeType.Queries;

    return subscribe;
  }

  /**
   * Raises the event when a query message is received.
   *
   * @param event The received query message.
   */
  raiseOnReceiveMessage(event: QueryMessageReceived) {
    if (this.onReceiveEventCallback) {
      this.onReceiveEventCallback(event);
    }
  }

  /**
   * Raises an error event when a subscription error occurs.
   *
   * @param errorMsg The error message.
   */
  raiseOnError(errorMsg: string) {
    if (this.onErrorCallback) {
      this.onErrorCallback(errorMsg);
    }
  }

  /**
   * Cancels the current query subscription.
   */
  cancel() {
    if (this.observer) {
      this.observer.cancel();
      console.debug('Query subscription cancelled');
    }
  }

  /**
   * Attempts to reconnect the query subscription in case of disconnection.
   *
   * @param cqClient The CQClient instance.
   * @param reconnectIntervalSeconds The interval (in seconds) before attempting reconnection.
   */
  reconnect(cqClient: CQClient, reconnectIntervalSeconds: number) {
    if (this.isReconnecting) {
      console.debug('Already reconnecting, skipping duplicate reconnection attempt');
      return;
    }

    this.isReconnecting = true;
    console.debug(`Reconnection attempt will start after ${reconnectIntervalSeconds} seconds`);
    setTimeout(async () => {
      console.debug('Attempting to re-subscribe...');
      try {
        this.cancel();  // Cancel the existing subscription before re-subscribing
        await cqClient.subscribeToQueries(this);
        console.debug('Re-subscribed successfully');
        this.isReconnecting = false;  // Reset the flag after a successful reconnection
      } catch (error) {
        console.error('Re-subscribe attempt failed', error);
        this.isReconnecting = false;  // Reset the flag on failure
      }
    }, reconnectIntervalSeconds * 1000);
  }
}

// QueriesResponse interface to represent the response of a query
export interface QueriesResponse {
  id: string;  // Unique identifier of the query response
  replyChannel?: string;  // Optional reply channel for the query response
  clientId: string;  // Client ID that processed the query response
  timestamp: number;  // Timestamp of the response
  executed: boolean;  // Whether the query was executed successfully
  error: string;  // Error message if the query failed
  metadata?: string;  // Optional metadata associated with the response
  body?: Uint8Array | string;  // Optional body content of the response
  tags?: Map<string, string>;  // Optional tags associated with the response
}
