import * as pb from '../protos';
import * as grpc from '@grpc/grpc-js';
import { Config } from '../client/config';
import { KubeMQClient,TypedEvent } from '../client/KubeMQClient';
import { createChannel, deleteChannel, listQueuesChannels } from '../common/common';
import { QueuesChannel } from '../common/channel_stats';
import { Utils } from '../common/utils';
import { QueueMessage, QueueMessageReceived, QueueMessageSendResult, QueuesAckAllMessagesRequest, QueuesAckAllMessagesResponse, QueuesMessageAttributes, QueuesMessagesPulledResponse, QueuesPullWaitngMessagesRequest, QueuesPullWaitingMessagesResponse, QueuesSubscribeMessagesCallback, QueuesSubscribeMessagesRequest, QueuesSubscribeMessagesResponse, QueueTransactionRequest, QueueTransactionSubscriptionResponse } from './queuesTypes';
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
     * Create new queue channel
     * @param channelName
     * @return Promise<void>
     */
    createQueuesChannel(channelName: string): Promise<void> {
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
    deleteQueuesChannel(channelName: string): Promise<void> {
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
    listQueuesChannel(search: string): Promise<QueuesChannel[]> {
      return listQueuesChannels(
        this.grpcClient,
        this.getMetadata(),
        this.clientId,
        search,
        'queues',
      );
    }


   /**
     * Send queue message
     * @param msg
     * @return Promise<QueueMessageSendResult>
     */
   sendQueuesMessage(msg: QueueMessage): Promise<QueueMessageSendResult> {
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
    receiveQueuesMessages(msg: QueuesPullWaitngMessagesRequest): Promise<QueuesMessagesPulledResponse> {
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
     * Pulls messages from a queue.
     * @param request
     * @return Promise<QueuesPullPeekMessagesResponse>
     */
    pull(
      request: QueuesPullWaitngMessagesRequest,
    ): Promise<QueuesPullWaitingMessagesResponse> {

      return this.pullOrWaiting(request, false);
    }
  
    /**
     * Get waiting messages from a queue.
     * @param request
     * @return Promise<QueuesPullPeekMessagesResponse>
     */
    waiting(
      request: QueuesPullWaitngMessagesRequest,
    ): Promise<QueuesPullWaitingMessagesResponse> {
      return this.pullOrWaiting(request, true);
    }
   
  
    /**
     * @internal
     */
    private pullOrWaiting(
      request: QueuesPullWaitngMessagesRequest,
      isPeek: boolean,
    ): Promise<QueuesPullWaitingMessagesResponse> {
      const pbPullSubRequest = new pb.kubemq.ReceiveQueueMessagesRequest();
      pbPullSubRequest.ClientID=(request.clientId ? request.clientId : this.clientId);
      pbPullSubRequest.Channel=(request.channel);
      pbPullSubRequest.IsPeak=(false);
      pbPullSubRequest.RequestID=(request.id ? request.id : Utils.uuid());
      pbPullSubRequest.MaxNumberOfMessages=(request.maxNumberOfMessages ? request.maxNumberOfMessages : 1);
      pbPullSubRequest.WaitTimeSeconds=(request.waitTimeoutSeconds ? request.waitTimeoutSeconds : 0);
      pbPullSubRequest.IsPeak=(isPeek);
      return new Promise<QueuesPullWaitingMessagesResponse>((resolve, reject) => {
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
    
  
  }
  
  