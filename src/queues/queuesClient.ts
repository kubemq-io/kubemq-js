import * as pb from '../protos';
import * as grpc from '@grpc/grpc-js';
import { Config } from '../client/config';
import { KubeMQClient,TypedEvent } from '../client/KubeMQClient';
import { createChannel, deleteChannel, listQueuesChannels } from '../common/common';
import { QueuesChannel } from '../common/channel_stats';
import { Utils } from '../common/utils';
import { QueueMessage, QueueMessageReceived, QueueMessageSendResult, QueuesAckAllMessagesRequest, QueuesAckAllMessagesResponse, QueuesMessageAttributes, QueuesMessagesPulledResponse, QueuesPullPeekMessagesRequest, QueuesPullPeekMessagesResponse, QueuesSubscribeMessagesCallback, QueuesSubscribeMessagesRequest, QueuesSubscribeMessagesResponse, QueueTransactionRequest, QueueTransactionSubscriptionResponse } from './queuesTypes';
import { QueueStreamHelper } from './QueueStreamHelper';
import { v4 as uuidv4 } from 'uuid';

/**
 * @internal
 */
const toQueueMessagePb = function (
    msg: QueueMessage,
    defClientId: string,
  ): pb.kubemq.QueueMessage {
    const pbMessage = new pb.kubemq.QueueMessage();
pbMessage.MessageID = msg.id ? msg.id : Utils.uuid();
pbMessage.ClientID = msg.clientId ? msg.clientId : defClientId;
pbMessage.Channel = msg.channel;
// Convert the string to Uint8Array
pbMessage.Body = typeof msg.body === 'string' ? new TextEncoder().encode(msg.body) : msg.body;

pbMessage.Metadata = msg.metadata;
if (msg.tags != null) {
  pbMessage.Tags = msg.tags;
}
if (msg.policy != null) {
  const pbMessagePolicy = new pb.kubemq.QueueMessagePolicy();
  pbMessagePolicy.DelaySeconds = msg.policy.delaySeconds ? msg.policy.delaySeconds : 0;
  pbMessagePolicy.ExpirationSeconds = msg.policy.expirationSeconds ? msg.policy.expirationSeconds : 0;
  pbMessagePolicy.MaxReceiveCount = msg.policy.maxReceiveCount ? msg.policy.maxReceiveCount : 0;
  pbMessagePolicy.MaxReceiveQueue = msg.policy.maxReceiveQueue ? msg.policy.maxReceiveQueue : '';
  pbMessage.Policy = pbMessagePolicy;
}
return pbMessage;
  };
  
  /**
   * @internal
   */
  const fromPbQueueMessage = function (msg: pb.kubemq.QueueMessage): QueueMessage {
    let msgAttributes: QueuesMessageAttributes = {};
    const receivedMessageAttr = msg.Attributes;
    if (receivedMessageAttr) {
      msgAttributes.delayedTo = receivedMessageAttr.DelayedTo;
      msgAttributes.expirationAt = receivedMessageAttr.ExpirationAt;
      msgAttributes.receiveCount = receivedMessageAttr.ReceiveCount;
      msgAttributes.reRouted = receivedMessageAttr.ReRouted;
      msgAttributes.reRoutedFromQueue = receivedMessageAttr.ReRoutedFromQueue;
      msgAttributes.sequence = msg.Attributes.Sequence;
      msgAttributes.timestamp = msg.Attributes.Timestamp;
    }
  
    return {
      id: msg.MessageID,
      channel: msg.Channel,
      clientId: msg.ClientID,
      metadata: msg.Metadata,
      body: msg.Body,
      tags: msg.Tags,
      attributes: msgAttributes,
    };
  };
  
  /**
   * Queue Client - KubeMQ queues client
   */
  export class QueuesClient extends KubeMQClient {

    queueStreamHelper = new QueueStreamHelper();

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
        // Generate a unique RequestID for the request
        const requestId = uuidv4();

        // Create an instance of QueuesUpstreamRequest with the generated RequestID and the message
        const qur = new pb.kubemq.QueuesUpstreamRequest({
            RequestID: requestId,
            Messages: [toQueueMessagePb(msg, this.clientId)], // Wrap the message in an array
        });

        // Use the queueStreamHelper to send the message
        this.queueStreamHelper.sendMessage(this, qur)
            .then(response => {
                resolve({
                    id: response.id,
                    sentAt: response.sentAt,
                    delayedTo: response.delayedTo,
                    error: response.error,
                    expirationAt: response.expirationAt,
                    isError: response.isError,
                });
            })
            .catch(error => {
                reject(error);
            });
    });
}

    /**
     * Send queue message
     * @param msg
     * @return Promise<QueueMessageSendResult>
     */
    receive(msg: QueuesPullPeekMessagesRequest): Promise<QueuesMessagesPulledResponse> {
      return new Promise<QueuesMessagesPulledResponse>((resolve, reject) => {
          // Generate a unique RequestID for the request
          const requestId = uuidv4();
  
          // Create an instance of QueuesDownstreamRequest with the generated RequestID and the message
          const qur = new pb.kubemq.QueuesDownstreamRequest({
              RequestID: requestId,
              ClientID: this.clientId,
              Channel: msg.channel,
              MaxItems: msg.maxNumberOfMessages,
              WaitTimeout: msg.waitTimeoutSeconds
          });
  
          // Use the queueStreamHelper to receive the message
          this.queueStreamHelper.receiveMessage(this, qur)
              .then(response => {
                  // Resolve the promise with the constructed response
                  resolve(response);
              })
              .catch(error => {
                  // Reject the promise with the error
                  reject(error);
              });
      });
  }
  
  
      
      
  
    /**
     * Send queue message
     * @param msg
     * @return Promise<QueueMessageSendResult>
     */
    // send(msg: QueueMessage): Promise<QueueMessageSendResult> {
    //   return new Promise<QueueMessageSendResult>((resolve, reject) => {
    //     this.grpcClient.sendQueueMessage(
    //       toQueueMessagePb(msg, this.clientId),
    //       this.getMetadata(),
    //       this.callOptions(),
    //       (e, response) => {
    //         if (e) {
    //           reject(e);
    //           return;
    //         }
    //         resolve({
    //           id: response.getMessageid(),
    //           sentAt: response.getSentat(),
    //           delayedTo: response.getDelayedto(),
    //           error: response.getError(),
    //           expirationAt: response.getExpirationat(),
    //           isError: response.getIserror(),
    //         });
    //       },
    //     );
    //   });
    // }
  
    /**
     * Send batch of queue messages
     * @param messages
     * @return Promise<QueueMessageSendResult[]>
     */
    batch(messages: QueueMessage[]): Promise<QueueMessageSendResult[]> {
      const pbBatchRequest = new pb.kubemq.QueueMessagesBatchRequest();
      pbBatchRequest.BatchID=(Utils.uuid());
      messages.forEach((msg) => {
        pbBatchRequest
          .Messages
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
      const pbPullSubRequest = new pb.kubemq.ReceiveQueueMessagesRequest();
      pbPullSubRequest.ClientID=(request.clientId ? request.clientId : this.clientId);
      pbPullSubRequest.Channel=(request.channel);
      pbPullSubRequest.IsPeak=(false);
      pbPullSubRequest.RequestID=(request.id ? request.id : Utils.uuid());
      pbPullSubRequest.MaxNumberOfMessages=(request.maxNumberOfMessages ? request.maxNumberOfMessages : 1);
      pbPullSubRequest.WaitTimeSeconds=(request.waitTimeoutSeconds ? request.waitTimeoutSeconds : 0);
      pbPullSubRequest.IsPeak=(isPeek);
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
      const pbMessage = new pb.kubemq.AckAllQueueMessagesRequest();
      pbMessage.RequestID=(request.id ? request.id : Utils.uuid());
      pbMessage.ClientID=(request.clientId ? request.clientId : this.clientId);
      pbMessage.Channel=(request.channel);
      pbMessage.WaitTimeSeconds=(request.waitTimeoutSeconds ? request.waitTimeoutSeconds : 0);
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
        stream.on('data', (result: pb.kubemq.StreamQueueMessagesResponse) => {
          if (result.IsError) {
            cb(new Error(result.Error), null);
          } else {
            const msg = result.Message;
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
        const msgRequest = new pb.kubemq.StreamQueueMessagesRequest();
        msgRequest.StreamRequestTypeData=(1);
        msgRequest.Channel=(request.channel);
        msgRequest.ClientID=( request.clientId ? request.clientId : this.clientId);
        msgRequest.WaitTimeSeconds=(request.waitTimeoutSeconds);
        msgRequest.VisibilitySeconds=(request.visibilitySeconds);
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
        pb.kubemq.StreamQueueMessagesRequest,
        pb.kubemq.StreamQueueMessagesResponse
      >,
      public message: QueueMessage,
    ) {}
  
    ack(): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        if (!this.message.attributes) {
          reject(new Error('no active queue msg to ack'));
          return;
        }
        const ackMessage = new pb.kubemq.StreamQueueMessagesRequest();
        ackMessage.StreamRequestTypeData=(2);
        ackMessage.RefSequence=(this.message.attributes.sequence);
        ackMessage.ClientID=(this.message.clientId);
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
        const rejectMessage = new pb.kubemq.StreamQueueMessagesRequest();
        rejectMessage.StreamRequestTypeData=(3);
        rejectMessage.RefSequence=(this.message.attributes.sequence);
        rejectMessage.ClientID=(this.message.clientId);
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
        const visibilityMessage = new pb.kubemq.StreamQueueMessagesRequest();
        visibilityMessage.StreamRequestTypeData=(4);
        visibilityMessage.RefSequence=(this.message.attributes.sequence);
        visibilityMessage.VisibilitySeconds=(newVisibilitySeconds);
        visibilityMessage.ClientID=(this.message.clientId);
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
  
        const resendMessage = new pb.kubemq.StreamQueueMessagesRequest();
        resendMessage.StreamRequestTypeData=(6);
        resendMessage.ModifiedMessage=(toQueueMessagePb(msg, this.message.clientId));
        resendMessage.ClientID=(this.message.clientId);
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
  
        const resendMessage = new pb.kubemq.StreamQueueMessagesRequest();
        resendMessage.StreamRequestTypeData=(5);
        resendMessage.Channel=(channel);
        resendMessage.ClientID=(this.message.clientId);
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