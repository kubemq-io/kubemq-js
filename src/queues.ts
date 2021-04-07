import { BaseMessage, Client } from './client';
import { Config } from './config';
import * as pb from '../src/protos';
import { Utils } from './utils';
import * as grpc from '@grpc/grpc-js';

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
  waitTimoutSeconds: number;
}

/**
 * Queue stream transactional callback
 */
export interface QueueTransactionCallback {
  (err: Error | null, msg: QueueTransactionMessage): void;
}
/**
 * @internal
 */
const toQueueMessagePb = function (
  msg: QueueMessage,
  defClientId: string,
): pb.QueueMessage {
  const pbMessage = new pb.QueueMessage();
  pbMessage.setMessageid(msg.id ? msg.id : Utils.uuid());
  pbMessage.setClientid(msg.clientId ? msg.clientId : defClientId);
  pbMessage.setChannel(msg.channel);
  pbMessage.setBody(msg.body);
  pbMessage.setMetadata(msg.metadata);
  if (msg.tags != null) {
    pbMessage.getTagsMap().set(msg.tags);
  }
  if (msg.policy != null) {
    const pbMessagePolicy = new pb.QueueMessagePolicy();
    pbMessagePolicy.setDelayseconds(
      msg.policy.delaySeconds ? msg.policy.delaySeconds : 0,
    );
    pbMessagePolicy.setExpirationseconds(
      msg.policy.expirationSeconds ? msg.policy.expirationSeconds : 0,
    );
    pbMessagePolicy.setMaxreceivecount(
      msg.policy.maxReceiveCount ? msg.policy.maxReceiveCount : 0,
    );
    pbMessagePolicy.setMaxreceivequeue(
      msg.policy.maxReceiveQueue ? msg.policy.maxReceiveQueue : '',
    );
    pbMessage.setPolicy(pbMessagePolicy);
  }
  return pbMessage;
};

/**
 * @internal
 */
const fromPbQueueMessage = function (msg: pb.QueueMessage): QueueMessage {
  let msgAttributes: QueuesMessageAttributes = {};
  const receivedMessageAttr = msg.getAttributes();
  if (receivedMessageAttr) {
    msgAttributes.delayedTo = receivedMessageAttr.getDelayedto();
    msgAttributes.expirationAt = receivedMessageAttr.getExpirationat();
    msgAttributes.receiveCount = receivedMessageAttr.getReceivecount();
    msgAttributes.reRouted = receivedMessageAttr.getRerouted();
    msgAttributes.reRoutedFromQueue = receivedMessageAttr.getReroutedfromqueue();
    msgAttributes.sequence = msg.getAttributes().getSequence();
    msgAttributes.timestamp = msg.getAttributes().getTimestamp();
  }

  return {
    id: msg.getMessageid(),
    channel: msg.getChannel(),
    clientId: msg.getClientid(),
    metadata: msg.getMetadata(),
    body: msg.getBody(),
    tags: msg.getTagsMap(),
    attributes: msgAttributes,
  };
};

/**
 * Queue Client - KubeMQ queues client
 */
export class QueuesClient extends Client {
  /**
   * @internal
   */
  constructor(Options: Config) {
    super(Options);
  }

  /**
   * Send queue message
   * @param msg
   * @return Promise<QueueMessageSendResult>
   */
  send(msg: QueueMessage): Promise<QueueMessageSendResult> {
    return new Promise<QueueMessageSendResult>((resolve, reject) => {
      this.grpcClient.sendQueueMessage(
        toQueueMessagePb(msg, this.clientOptions.clientId),
        this.getMetadata(),
        this.callOptions(),
        (e, response) => {
          if (e) {
            reject(e);
            return;
          }
          resolve({
            id: response.getMessageid(),
            sentAt: response.getSentat(),
            delayedTo: response.getDelayedto(),
            error: response.getError(),
            expirationAt: response.getExpirationat(),
            isError: response.getIserror(),
          });
        },
      );
    });
  }

  /**
   * Send batch of queue messages
   * @param messages
   * @return Promise<QueueMessageSendResult[]>
   */
  batch(messages: QueueMessage[]): Promise<QueueMessageSendResult[]> {
    const pbBatchRequest = new pb.QueueMessagesBatchRequest();
    pbBatchRequest.setBatchid(Utils.uuid());
    messages.forEach((msg) => {
      pbBatchRequest
        .getMessagesList()
        .push(toQueueMessagePb(msg, this.clientOptions.clientId));
    });
    return new Promise<QueueMessageSendResult[]>((resolve, reject) => {
      this.grpcClient.sendQueueMessagesBatch(
        pbBatchRequest,
        this.getMetadata(),
        this.callOptions(),
        (e, responseBatch) => {
          if (e) {
            reject(e);
            return;
          }
          const batchResp: QueueMessageSendResult[] = [];
          responseBatch.getResultsList().forEach((response) => {
            batchResp.push({
              id: response.getMessageid(),
              sentAt: response.getSentat(),
              delayedTo: response.getDelayedto(),
              error: response.getError(),
              expirationAt: response.getExpirationat(),
              isError: response.getIserror(),
            });
          });

          resolve(batchResp);
        },
      );
    });
  }

  /**
   * Pull batch of queue messages
   * @param request
   * @return Promise<QueuesPullPeekMessagesResponse>
   */
  pull(
    request: QueuesPullPeekMessagesRequest,
  ): Promise<QueuesPullPeekMessagesResponse> {
    return this.pullOrPeek(request, false);
  }

  /**
   * Peek batch of queue messages
   * @param request
   * @return Promise<QueuesPullPeekMessagesResponse>
   */
  peek(
    request: QueuesPullPeekMessagesRequest,
  ): Promise<QueuesPullPeekMessagesResponse> {
    return this.pullOrPeek(request, true);
  }

  /**
   * @internal
   */
  private pullOrPeek(
    request: QueuesPullPeekMessagesRequest,
    isPeek: boolean,
  ): Promise<QueuesPullPeekMessagesResponse> {
    const pbPullSubRequest = new pb.ReceiveQueueMessagesRequest();
    pbPullSubRequest.setClientid(
      request.clientId ? request.clientId : this.clientOptions.clientId,
    );

    pbPullSubRequest.setChannel(request.channel);
    pbPullSubRequest.setIspeak(false);
    pbPullSubRequest.setRequestid(request.id ? request.id : Utils.uuid());
    pbPullSubRequest.setMaxnumberofmessages(
      request.maxNumberOfMessages ? request.maxNumberOfMessages : 1,
    );
    pbPullSubRequest.setWaittimeseconds(
      request.waitTimeoutSeconds ? request.waitTimeoutSeconds : 0,
    );
    pbPullSubRequest.setIspeak(isPeek);
    return new Promise<QueuesPullPeekMessagesResponse>((resolve, reject) => {
      this.grpcClient.receiveQueueMessages(
        pbPullSubRequest,
        this.getMetadata(),
        (e, response) => {
          if (e) {
            reject(e);
            return;
          }
          const respMessages: QueueMessage[] = [];
          response.getMessagesList().forEach((msg) => {
            respMessages.push(fromPbQueueMessage(msg));
          });
          resolve({
            id: response.getRequestid(),
            messages: respMessages,
            error: response.getError(),
            isError: response.getIserror(),
            isPeek: isPeek,
            messagesExpired: response.getMessagesexpired(),
            messagesReceived: response.getMessagesreceived(),
          });
        },
      );
    });
  }
  /**
   * Ack all messages in queue
   * @param request
   * @return Promise<QueuesAckAllMessagesResponse>
   */
  ackAll(
    request: QueuesAckAllMessagesRequest,
  ): Promise<QueuesAckAllMessagesResponse> {
    const pbMessage = new pb.AckAllQueueMessagesRequest();
    pbMessage.setRequestid(request.id ? request.id : Utils.uuid());
    pbMessage.setClientid(
      request.clientId ? request.clientId : this.clientOptions.clientId,
    );
    pbMessage.setChannel(request.channel);
    pbMessage.setWaittimeseconds(
      request.waitTimeoutSeconds ? request.waitTimeoutSeconds : 0,
    );
    return new Promise<QueuesAckAllMessagesResponse>((resolve, reject) =>
      this.grpcClient.ackAllQueueMessages(
        pbMessage,
        this.getMetadata(),
        this.callOptions(),
        (err, response) => {
          if (err) {
            reject(err);
            return;
          }
          resolve({
            affectedMessages: response.getAffectedmessages(),
            error: response.getError(),
            id: response.getRequestid(),
            isError: response.getIserror(),
          });
        },
      ),
    );
  }
  /**
   * Start pull queue message transaction
   * @param request
   * @param cb
   * @return Promise<QueueTransactionRequest>
   */
  public transaction(
    request: QueueTransactionRequest,
    cb: QueueTransactionCallback,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!cb) {
        reject(new Error('transaction queue message call requires a callback'));
        return;
      }
      const stream = this.grpcClient.streamQueueMessage(this.getMetadata());
      stream.on('data', (result: pb.StreamQueueMessagesResponse) => {
        if (result.getIserror()) {
          cb(new Error(result.getError()), null);
        } else {
          const msg = result.getMessage();
          if (msg) {
            cb(
              null,
              new QueueTransactionMessage(stream, fromPbQueueMessage(msg)),
            );
          }
        }
      });
      stream.on('error', (e: Error) => {
        cb(e, null);
      });
      const msgRequest = new pb.StreamQueueMessagesRequest();
      msgRequest.setStreamrequesttypedata(1);
      msgRequest.setChannel(request.channel);
      msgRequest.setClientid(
        request.clientId ? request.clientId : this.clientOptions.clientId,
      );
      msgRequest.setWaittimeseconds(request.waitTimoutSeconds);
      msgRequest.setVisibilityseconds(request.visibilitySeconds);
      stream.write(msgRequest, (err: Error) => {
        cb(err, null);
      });
      resolve();
    });
  }
}

/**
 * @internal
 */
export class QueueTransactionMessage {
  constructor(
    private _stream: grpc.ClientDuplexStream<
      pb.StreamQueueMessagesRequest,
      pb.StreamQueueMessagesResponse
    >,
    public message: QueueMessage,
  ) {}

  ack(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.message.attributes) {
        reject(new Error('no active queue msg to ack'));
        return;
      }
      const ackMessage = new pb.StreamQueueMessagesRequest();
      ackMessage.setStreamrequesttypedata(2);
      ackMessage.setRefsequence(this.message.attributes.sequence);
      ackMessage.setClientid(this.message.clientId);
      this._stream.write(ackMessage, (err: Error) => {
        reject(err);
        return;
      });

      resolve();
    });
  }
  reject(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.message.attributes) {
        reject(new Error('no active queue msg to reject'));
        return;
      }
      const rejectMessage = new pb.StreamQueueMessagesRequest();
      rejectMessage.setStreamrequesttypedata(3);
      rejectMessage.setRefsequence(this.message.attributes.sequence);
      rejectMessage.setClientid(this.message.clientId);
      this._stream.write(rejectMessage, (err: Error) => {
        reject(err);
        return;
      });
      resolve();
    });
  }

  extendVisibility(newVisibilitySeconds: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.message.attributes) {
        reject(new Error('no active queue msg to extend visibility'));
        return;
      }
      const visibilityMessage = new pb.StreamQueueMessagesRequest();
      visibilityMessage.setStreamrequesttypedata(4);
      visibilityMessage.setRefsequence(this.message.attributes.sequence);
      visibilityMessage.setVisibilityseconds(newVisibilitySeconds);
      visibilityMessage.setClientid(this.message.clientId);
      this._stream.write(visibilityMessage, (err: Error) => {
        reject(err);
        return;
      });
      resolve();
    });
  }
  resendNewMessage(msg: QueueMessage): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.message.attributes) {
        reject(new Error('no active queue msg to extend visibility'));
        return;
      }

      const resendMessage = new pb.StreamQueueMessagesRequest();
      resendMessage.setStreamrequesttypedata(6);
      resendMessage.setModifiedmessage(
        toQueueMessagePb(msg, this.message.clientId),
      );
      resendMessage.setClientid(this.message.clientId);
      this._stream.write(resendMessage, (err: Error) => {
        reject(err);
        return;
      });
      resolve();
    });
  }
  resendToChannel(channel: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.message.attributes) {
        reject(new Error('no active queue msg to extend visibility'));
        return;
      }

      const resendMessage = new pb.StreamQueueMessagesRequest();
      resendMessage.setStreamrequesttypedata(5);
      resendMessage.setChannel(channel);
      resendMessage.setClientid(this.message.clientId);
      this._stream.write(resendMessage, (err: Error) => {
        reject(err);
        return;
      });
      resolve();
    });
  }
}
