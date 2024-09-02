import { BaseMessage, TypedEvent } from "../client/KubeMQClient";
import * as pb from '../protos';
import * as grpc from '@grpc/grpc-js';
import { v4 as uuidv4 } from 'uuid';


export class QueueMessageReceived {
  id: string;
  channel: string;
  metadata: string;
  body: Uint8Array;
  fromClientId: string;
  tags: Map<string, string> = new Map<string, string>();
  timestamp: Date;
  sequence: number;
  receiveCount: number;
  isReRouted: boolean;
  reRouteFromQueue?: string;
  expiredAt?: Date;
  delayedTo?: Date;
  transactionId: string;
  isTransactionCompleted: boolean;
  responseHandler: grpc.ClientWritableStream<pb.kubemq.QueuesDownstreamRequest>;
  receiverClientId: string;

  constructor(
    id: string,
    channel: string,
    metadata: string,
    body: Uint8Array,
    fromClientId: string,
    tags: Map<string, string>,
    timestamp: Date,
    sequence: number,
    receiveCount: number,
    isReRouted: boolean,
    reRouteFromQueue: string | undefined,
    expiredAt: Date | undefined,
    delayedTo: Date | undefined,
    transactionId: string,
    isTransactionCompleted: boolean,
    responseHandler:  grpc.ClientWritableStream<pb.kubemq.QueuesDownstreamRequest>,
    receiverClientId: string
  ) {
    this.id = id;
    this.channel = channel;
    this.metadata = metadata;
    this.body = body;
    this.fromClientId = fromClientId;
    this.tags = tags;
    this.timestamp = timestamp;
    this.sequence = sequence;
    this.receiveCount = receiveCount;
    this.isReRouted = isReRouted;
    this.reRouteFromQueue = reRouteFromQueue;
    this.expiredAt = expiredAt;
    this.delayedTo = delayedTo;
    this.transactionId = transactionId;
    this.isTransactionCompleted = isTransactionCompleted;
    this.responseHandler = responseHandler;
    this.receiverClientId = receiverClientId;
  }

  ack(): void {
    if (this.isTransactionCompleted) {
      throw new Error('Transaction is already completed');
    }

    const request = new pb.kubemq.QueuesDownstreamRequest({
      RequestID: uuidv4(),
      ClientID: this.receiverClientId,
      Channel: this.channel,
      RequestTypeData: pb.kubemq.QueuesDownstreamRequestType.AckRange,
      RefTransactionId: this.transactionId,
      SequenceRange: [this.sequence],
      MaxItems: 0, // Set default value if not needed
      WaitTimeout: 0, // Set default value if not needed
      AutoAck: false, // Set default value if not needed
      Metadata: new Map(), // Initialize with an empty map if not needed
    });

    this.responseHandler.write(request);
  }

  reject(): void {
    if (this.isTransactionCompleted) {
      throw new Error('Transaction is already completed');
    }

    const request = new pb.kubemq.QueuesDownstreamRequest({
      RequestID: uuidv4(),
      ClientID: this.receiverClientId,
      Channel: this.channel,
      RequestTypeData: pb.kubemq.QueuesDownstreamRequestType.NAckRange,
      RefTransactionId: this.transactionId,
      SequenceRange: [this.sequence],
      MaxItems: 0, // Set default value if not needed
      WaitTimeout: 0, // Set default value if not needed
      AutoAck: false, // Set default value if not needed
      Metadata: new Map(), // Initialize with an empty map if not needed
    });    

    this.responseHandler.write(request);
  }

  reQueue(channel: string): void {
    if (!channel || channel.length === 0) {
      throw new Error('Re-queue channel cannot be empty');
    }

    const request = new pb.kubemq.QueuesDownstreamRequest({
      RequestID: uuidv4(),
      ClientID: this.receiverClientId,
      Channel: this.channel,
      RequestTypeData: pb.kubemq.QueuesDownstreamRequestType.ReQueueRange,
      RefTransactionId: this.transactionId,
      SequenceRange: [this.sequence],
      MaxItems: 0, // Set default value if not needed
      WaitTimeout: 0, // Set default value if not needed
      AutoAck: false, // Set default value if not needed
      Metadata: new Map(), // Initialize with an empty map if not needed
    });

    this.responseHandler.write(request);
  }

  static decode(
    message: pb.kubemq.QueueMessage,
    transactionId: string,
    transactionIsCompleted: boolean,
    receiverClientId: string,
    responseHandler:  grpc.ClientWritableStream<pb.kubemq.QueuesDownstreamRequest>
  ): QueueMessageReceived {
    return new QueueMessageReceived(
      message.MessageID,
      message.Channel,
      message.Metadata,
      typeof message.Body === 'string' ? new TextEncoder().encode(message.Body) : message.Body,
      message.ClientID,
      new Map(Object.entries(message.Tags)),
      new Date(message.Attributes.Timestamp / 1_000_000_000),
      message.Attributes.Sequence,
      message.Attributes.ReceiveCount,
      message.Attributes.ReRouted,
      message.Attributes.ReRoutedFromQueue,
      message.Attributes.ExpirationAt ? new Date(message.Attributes.ExpirationAt / 1_000_000) : undefined,
      message.Attributes.DelayedTo ? new Date(message.Attributes.DelayedTo / 1_000_000) : undefined,
      transactionId,
      transactionIsCompleted,
      responseHandler,
      receiverClientId
    );
  }

  toString(): string {
    return `QueueMessageReceived: id=${this.id}, channel=${this.channel}, metadata=${this.metadata}, body=${Buffer.from(
      this.body
    ).toString()}, fromClientId=${this.fromClientId}, timestamp=${this.timestamp.toISOString()}, sequence=${
      this.sequence
    }, receiveCount=${this.receiveCount}, isReRouted=${this.isReRouted}, reRouteFromQueue=${this.reRouteFromQueue}, expiredAt=${
      this.expiredAt?.toISOString() || 'N/A'
    }, delayedTo=${this.delayedTo?.toISOString() || 'N/A'}, transactionId=${
      this.transactionId
    }, isTransactionCompleted=${this.isTransactionCompleted}, tags=${JSON.stringify(Array.from(this.tags.entries()))}`;
  }
}


/**
 * queue message attributes
 */
export interface QueuesMessageAttributes {
  /** queue message timestamp */
  timestamp?: number;

  /** queue message sequence */
  sequence?: number;

  /** how many times the queue message consumed so far */
  receiveCount?: number;

  /** indicate if the message was re-routed from another queue (dead-letter) */
  reRouted?: boolean;

  /** indicate the re-routed message originate queue */
  reRoutedFromQueue?: string;

  /** indicate when the message will expire */
  expirationAt?: number;

  /** indicate to when the message was delayed */
  delayedTo?: number;
}

/**
 * queue message policy
 */
export interface QueueMessagePolicy {
  /** set message expiration in seconds from now */
  expirationSeconds?: number;

  /** set message delay in seconds from now */
  delaySeconds?: number;

  /** set how many times the message will be send back to the queue before re-routed to a dead-letter queue */
  maxReceiveCount?: number;

  /** set dead-letter queue */
  maxReceiveQueue?: string;
}

/**
 * queue base message
 */
export interface QueueMessage extends BaseMessage {
  attributes?: QueuesMessageAttributes;
  policy?: QueueMessagePolicy;
}


/**
 * queue message sending result
 */
export interface QueueMessageSendResult {
  /** message id */
  id: string;

  /** message sending time */
  sentAt: number;

  /** message expiration time*/
  expirationAt: number;

  /** message delay time*/
  delayedTo: number;

  /** indicate sending message error*/
  isError: boolean;

  /** indicate sending message reason*/
  error: string;
}

/**
 * queue messages pull/peek requests
 */
export interface QueuesPullPeekMessagesRequest {
  /** pull/peek request id*/
  id?: string;

  /** pull/peek request channel */
  channel: string;

  /** pull/peek request clientId */
  clientId?: string;

  /** pull/peek request max messages in one call */
  maxNumberOfMessages: number;

  /** how long to wait for max number of messages */
  waitTimeoutSeconds: number;
}
/** queue messages subscribeFn callback */
export interface QueuesSubscribeMessagesCallback {
  (err: Error | null, response: QueuesPullPeekMessagesResponse): void;
}
/** queue messages subscribeFn callback*/
export interface QueuesSubscribeMessagesResponse {
  /** emit error on subscription request error*/
  onError: TypedEvent<Error>;
  /** call unsubscribe*/
  unsubscribe(): void;
}
/**
 * queue messages subscribeFn requests
 */
export interface QueuesSubscribeMessagesRequest {
  /** subscribeFn request id*/
  id?: string;

  /** subscribeFn request channel */
  channel: string;

  /** subscribeFn request clientId */
  clientId?: string;

  /** subscribeFn request max messages in one call */
  maxNumberOfMessages: number;

  /** how long to wait for max number of messages */
  waitTimeoutSeconds: number;
}

/**
 * queue messages pull/peek response
 */
export interface QueuesPullPeekMessagesResponse {
  /** pull/peek request id*/
  id?: string;

  /** array of received queue messages */
  messages: QueueMessage[];

  /** number of valid messages received */
  messagesReceived: number;

  /** number of expired messages from the queue */
  messagesExpired: number;

  /** is peek or pull */
  isPeek: boolean;

  /** indicate pull/peek error */
  isError: boolean;

  /** pull/peek error reason*/
  error: string;
}

/**
 * queue messages pull/peek response
 */
export interface QueuesMessagesPulledResponse {
  /** pull/peek request id*/
  id?: string;

  /** array of received queue messages */
  messages: QueueMessageReceived[];

  /** number of valid messages received */
  messagesReceived: number;

  /** number of expired messages from the queue */
  messagesExpired: number;

  /** is peek or pull */
  isPeek: boolean;

  /** indicate pull/peek error */
  isError: boolean;

  /** pull/peek error reason*/
  error: string;
}

/**
 * Ack all queue messages request
 */
export interface QueuesAckAllMessagesRequest {
  /** ack all request id*/
  id?: string;

  /** ack all channel*/
  channel: string;

  /** ack all clientId*/
  clientId?: string;

  /** how long to wait for ack all messages*/
  waitTimeoutSeconds: number;
}
/**
 * Ack all queue messages response
 */
export interface QueuesAckAllMessagesResponse {
  /** ack all request id*/
  id?: string;

  /** how many messages where ack*/
  affectedMessages: number;

  /** indicate ack all error */
  isError: boolean;

  /** ack all error reason*/
  error: string;
}

/**
 * Queue stream transactional request
 */
export interface QueueTransactionRequest {
  /** request channel*/
  channel: string;

  /** request clientId*/
  clientId?: string;

  /** set how long to hide the received message from other clients during processing*/
  visibilitySeconds: number;

  /** set how long to wait for queue message*/
  waitTimeoutSeconds: number;
}

/**
 * Queue stream transactional subscription request
 */
export interface QueueTransactionSubscriptionRequest {
  /** request channel*/
  channel: string;

  /** request clientId*/
  clientId?: string;

  /** set how long to hide the received message from other clients during processing*/
  visibilitySeconds: number;

  /** set how long to wait for queue message*/
  waitTimoutSeconds: number;
}
/** Queue stream transactional subscription response*/
export interface QueueTransactionSubscriptionResponse {
  /** emit errors on transactions*/
  onError: TypedEvent<Error>;
  /** call unsubscribe*/
  unsubscribe(): void;
}


