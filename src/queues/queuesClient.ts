import * as pb from '../protos';
import * as grpc from '@grpc/grpc-js';
import { Config } from '../client/config';
import { KubeMQClient,TypedEvent } from '../client/KubeMQClient';
import { createChannel, deleteChannel, listQueuesChannels } from '../common/common';
import { QueuesChannel } from '../common/channel_stats';
import { Utils } from '../common/utils';
import { QueueMessage, QueueMessageSendResult, QueuesAckAllMessagesRequest, QueuesAckAllMessagesResponse, QueuesMessageAttributes, QueuesPullPeekMessagesRequest, QueuesPullPeekMessagesResponse, QueuesSubscribeMessagesCallback, QueuesSubscribeMessagesRequest, QueuesSubscribeMessagesResponse, QueueTransactionRequest, QueueTransactionSubscriptionResponse } from './queuesTypes';

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
  export class QueuesClient extends KubeMQClient {
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
          toQueueMessagePb(msg, this.clientId),
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
          .push(toQueueMessagePb(msg, this.clientId));
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
     * Create new queue channel
     * @param channelName
     * @return Promise<void>
     */
    create(channelName: string): Promise<void> {
      return createChannel(
        this.grpcClient,
        this.getMetadata(),
        this.clientId,
        channelName,
        'queues',
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
        'queues',
      );
    }
  
    /**
     * List queues channels
     * @param search
     * @return Promise<QueuesChannel[]>
     */
    list(search: string): Promise<QueuesChannel[]> {
      return listQueuesChannels(
        this.grpcClient,
        this.getMetadata(),
        this.clientId,
        search,
        'queues',
      );
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
     * Subscribe is pulling messages in a loop batch of queue messages
     * @param request
     * @param cb
     * @return Promise<QueuesSubscribeMessagesResponse>
     */
    async subscribe(
      request: QueuesSubscribeMessagesRequest,
      cb: QueuesSubscribeMessagesCallback,
    ): Promise<QueuesSubscribeMessagesResponse> {
      return new Promise<QueuesSubscribeMessagesResponse>(
        async (resolve, reject) => {
          if (!cb) {
            reject(
              new Error('subscribeFn queue message call requires a callback'),
            );
            return;
          }
          let isCancelled = false;
          let onErrorEvent = new TypedEvent<Error>();
          const unsubscribe = () => {
            isCancelled = true;
          };
          resolve({
            onError: onErrorEvent,
            unsubscribe: unsubscribe,
          });
          while (!isCancelled) {
            await this.pull(request)
              .then((response) => {
                cb(null, response);
              })
              .catch(async (reason) => {
                onErrorEvent.emit(reason);
                await new Promise((r) =>
                  setTimeout(
                    r,
                    this.reconnectIntervalSeconds
                      ? this.reconnectIntervalSeconds
                      : 1000,
                  ),
                );
              });
          }
        },
      );
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
        request.clientId ? request.clientId : this.clientId,
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
        request.clientId ? request.clientId : this.clientId,
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
     * TransactionSubscribe is streaming transaction messages in a loop
     * @param request
     * @param cb
     * @return Promise<QueuesSubscribeMessagesResponse>
     */
    async transactionStream(
      request: QueueTransactionRequest,
      cb: QueueTransactionCallback,
    ): Promise<QueueTransactionSubscriptionResponse> {
      return new Promise<QueueTransactionSubscriptionResponse>(
        async (resolve, reject) => {
          if (!cb) {
            reject(
              new Error('transaction subscription call requires a callback'),
            );
            return;
          }
          let isCancelled = false;
          let onErrorEvent = new TypedEvent<Error>();
          const unsubscribe = () => {
            isCancelled = true;
          };
          resolve({
            onError: onErrorEvent,
            unsubscribe: unsubscribe,
          });
  
          while (!isCancelled) {
            await this.transaction(request, cb)
              .then(() => {})
              .catch(async (reason) => {
                onErrorEvent.emit(reason);
                await new Promise((r) =>
                  setTimeout(
                    r,
                    this.reconnectIntervalSeconds
                      ? this.reconnectIntervalSeconds
                      : 1000,
                  ),
                );
              });
          }
        },
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
          reject(e);
        });
        const msgRequest = new pb.StreamQueueMessagesRequest();
        msgRequest.setStreamrequesttypedata(1);
        msgRequest.setChannel(request.channel);
        msgRequest.setClientid(
          request.clientId ? request.clientId : this.clientId,
        );
        msgRequest.setWaittimeseconds(request.waitTimeoutSeconds);
        msgRequest.setVisibilityseconds(request.visibilitySeconds);
        stream.write(msgRequest, (err: Error) => {
          cb(err, null);
        });
        stream.on('end', () => {
          resolve();
        });
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
  
  /**
 * Queue stream transactional callback
 */
export interface QueueTransactionCallback {
  (err: Error | null, msg: QueueTransactionMessage): void;
}