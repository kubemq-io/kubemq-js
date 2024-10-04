import { BaseMessage, TypedEvent } from '../client/KubeMQClient';
import { Utils } from '../common/utils';
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

  // New fields introduced in Java
  visibilitySeconds: number;
  isAutoAcked: boolean;
  private visibilityTimer?: NodeJS.Timeout;
  private messageCompleted: boolean = false;
  private timerExpired: boolean = false;

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
    responseHandler: grpc.ClientWritableStream<pb.kubemq.QueuesDownstreamRequest>,
    receiverClientId: string,
    visibilitySeconds: number,
    isAutoAcked: boolean,
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
    this.visibilitySeconds = visibilitySeconds;
    this.isAutoAcked = isAutoAcked;

    if (this.visibilitySeconds > 0) {
      this.startVisibilityTimer();
    }
  }

  private startVisibilityTimer(): void {
    if (this.visibilitySeconds > 0) {
      this.visibilityTimer = setTimeout(
        () => this.onVisibilityExpired(),
        this.visibilitySeconds * 1000,
      );
    }
  }

  private onVisibilityExpired(): void {
    this.timerExpired = true;
    this.visibilityTimer = undefined;
    this.reject();
    throw new Error('Message visibility expired');
  }

  public extendVisibilityTimer(additionalSeconds: number): void {
    if (additionalSeconds <= 0) {
      throw new Error('additionalSeconds must be greater than 0');
    }
    if (!this.visibilityTimer) {
      throw new Error('Cannot extend, timer not active');
    }
    if (this.timerExpired) {
      throw new Error('Cannot extend, timer has expired');
    }
    if (this.messageCompleted) {
      throw new Error('Message transaction is already completed');
    }

    clearTimeout(this.visibilityTimer);
    this.visibilitySeconds += additionalSeconds;
    this.startVisibilityTimer();
  }

  ack(): void {
    if (this.messageCompleted || this.isTransactionCompleted) {
      throw new Error('Transaction is already completed');
    }
    if (this.isAutoAcked) {
      throw new Error('Auto-acked message, operations are not allowed');
    }

    const request = new pb.kubemq.QueuesDownstreamRequest({
      RequestID: uuidv4(),
      ClientID: this.receiverClientId,
      Channel: this.channel,
      RequestTypeData: pb.kubemq.QueuesDownstreamRequestType.AckRange,
      RefTransactionId: this.transactionId,
      SequenceRange: [this.sequence],
    });

    const result = this.responseHandler.write(request);
    if (!result) {
      throw new Error('Failed to ack message');
    }
    this.markTransactionCompleted();
  }

  reject(): void {
    if (this.messageCompleted || this.isTransactionCompleted) {
      throw new Error('Transaction is already completed');
    }
    if (this.isAutoAcked) {
      throw new Error('Auto-acked message, operations are not allowed');
    }

    const request = new pb.kubemq.QueuesDownstreamRequest({
      RequestID: uuidv4(),
      ClientID: this.receiverClientId,
      Channel: this.channel,
      RequestTypeData: pb.kubemq.QueuesDownstreamRequestType.NAckRange,
      RefTransactionId: this.transactionId,
      SequenceRange: [this.sequence],
    });
    const result = this.responseHandler.write(request);
    if (!result) {
      throw new Error('Failed to reject message');
    }
    this.markTransactionCompleted();
  }

  reQueue(channel: string): void {
    if (!channel || channel.length === 0) {
      throw new Error('Re-queue channel cannot be empty');
    }
    if (this.messageCompleted || this.isTransactionCompleted) {
      throw new Error('Transaction is already completed');
    }
    if (this.isAutoAcked) {
      throw new Error('Auto-acked message, operations are not allowed');
    }

    const request = new pb.kubemq.QueuesDownstreamRequest({
      RequestID: uuidv4(),
      ClientID: this.receiverClientId,
      Channel: this.channel,
      RequestTypeData: pb.kubemq.QueuesDownstreamRequestType.ReQueueRange,
      RefTransactionId: this.transactionId,
      SequenceRange: [this.sequence],
      ReQueueChannel: channel,
    });

    const result = this.responseHandler.write(request);
    if (!result) {
      throw new Error('Failed to re-queue message');
    }
    this.markTransactionCompleted();
  }

  private markTransactionCompleted(): void {
    this.messageCompleted = true;
    this.isTransactionCompleted = true;

    if (this.visibilityTimer) {
      clearTimeout(this.visibilityTimer);
    }
  }

  static decode(
    message: pb.kubemq.QueueMessage,
    transactionId: string,
    transactionIsCompleted: boolean,
    receiverClientId: string,
    responseHandler: grpc.ClientWritableStream<pb.kubemq.QueuesDownstreamRequest>,
    visibilitySeconds: number,
    isAutoAcked: boolean,
  ): QueueMessageReceived {
    return new QueueMessageReceived(
      message.MessageID,
      message.Channel,
      message.Metadata,
      typeof message.Body === 'string'
        ? new TextEncoder().encode(message.Body)
        : message.Body,
      message.ClientID,
      new Map(Object.entries(message.Tags)),
      new Date(message.Attributes.Timestamp / 1_000_000_000),
      message.Attributes.Sequence,
      message.Attributes.ReceiveCount,
      message.Attributes.ReRouted,
      message.Attributes.ReRoutedFromQueue,
      message.Attributes.ExpirationAt
        ? new Date(message.Attributes.ExpirationAt / 1_000_000)
        : undefined,
      message.Attributes.DelayedTo
        ? new Date(message.Attributes.DelayedTo / 1_000_000)
        : undefined,
      transactionId,
      transactionIsCompleted,
      responseHandler,
      receiverClientId,
      visibilitySeconds,
      isAutoAcked,
    );
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

export class QueuesPollRequest {
  channel: string;
  pollMaxMessages: number;
  pollWaitTimeoutInSeconds: number;
  autoAckMessages: boolean;
  visibilitySeconds: number;

  constructor(data: {
    channel: string;
    pollMaxMessages?: number;
    pollWaitTimeoutInSeconds?: number;
    autoAckMessages?: boolean;
    visibilitySeconds?: number;
  }) {
    this.channel = data.channel;
    this.pollMaxMessages = data.pollMaxMessages ?? 1; // Default to 1 if not provided
    this.pollWaitTimeoutInSeconds = data.pollWaitTimeoutInSeconds ?? 60; // Default to 60 seconds if not provided
    this.autoAckMessages = data.autoAckMessages ?? false; // Default to false if not provided
    this.visibilitySeconds = data.visibilitySeconds ?? 0;
  }

  validate() {
    if (!this.channel || this.channel.trim() === '') {
      throw new Error('Queue subscription must have a channel.');
    }
    if (this.pollMaxMessages < 1) {
      throw new Error('pollMaxMessages must be greater than 0.');
    }
    if (this.pollWaitTimeoutInSeconds < 1) {
      throw new Error('pollWaitTimeoutInSeconds must be greater than 0.');
    }
    if (this.visibilitySeconds < 0) {
      throw new Error('Visibility timeout must be a non-negative integer.');
    }
    if (this.autoAckMessages && this.visibilitySeconds > 0) {
      throw new Error(
        'autoAckMessages and visibilitySeconds cannot be set together.',
      );
    }
  }

  encode(clientId: string) {
    this.validate(); // Perform validation before encoding

    return new pb.kubemq.QueuesDownstreamRequest({
      RequestID: Utils.uuid(), // Generate a random UUID
      ClientID: clientId,
      Channel: this.channel,
      MaxItems: this.pollMaxMessages,
      WaitTimeout: this.pollWaitTimeoutInSeconds * 1000, // Convert seconds to milliseconds
      AutoAck: this.autoAckMessages,
      RequestTypeData: pb.kubemq.QueuesDownstreamRequestType.Get, // Assuming this is the correct type
    });
  }
}

/**
 * queue messages pull/peek requests
 */
export interface QueuesPullWaitingMessagesRequest {
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
  (err: Error | null, response: QueuesPullWaitingMessagesResponse): void;
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
export interface QueuesPullWaitingMessagesResponse {
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

  visibilitySeconds: number;

  isAutoAcked: boolean;
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
