import { BaseMessage, TypedEvent } from "../client/KubeMQClient";

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


