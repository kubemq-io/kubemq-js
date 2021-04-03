import { BaseMessage, Client } from './client';
import { Config } from './config';
import * as pb from '../src/protos';
import { Utils } from './utils';

export interface QueuesMessageAttributes {
  timestamp?: number;
  sequence?: number;
  receiveCount?: number;
  reRouted?: boolean;
  reRoutedFromQueue?: string;
  expirationAt?: number;
  delayedTo?: number;
}
export interface QueueMessagePolicy {
  expirationSeconds?: number;
  delaySeconds?: number;
  maxReceiveCount?: number;
  maxReceiveQueue?: string;
}

export interface QueueMessage extends BaseMessage {
  attributes?: QueuesMessageAttributes;
  policy?: QueueMessagePolicy;
}

export interface QueueMessageSendResult {
  id: string;
  sentAt: number;
  expirationAt: number;
  delayedTo: number;
  isError: boolean;
  error: string;
}

export interface QueuesPullMessagesRequest {
  id?: string;
  channel: string;
  clientId?: string;
  maxNumberOfMessages: number;
  waitTimeout: number;
}

export interface QueuesPullMessagesResponse {
  id?: string;
  messages: QueueMessage[];
  messagesReceived: number;
  messagesExpired: number;
  isPeek: boolean;
  isError: boolean;
  error: string;
}

export interface QueuesAckAllMessagesRequest {
  id?: string;
  channel: string;
  clientId?: string;
  waitTimeout: number;
}

export interface QueuesAckAllMessagesResponse {
  id?: string;
  affectedMessages: number;
  isError: boolean;
  error: string;
}

export class QueuesClient extends Client {
  constructor(Options: Config) {
    super(Options);
  }
  public send(message: QueueMessage): Promise<QueueMessageSendResult> {
    const pbMessage = new pb.QueueMessage();
    pbMessage.setMessageid(message.id ? message.id : Utils.uuid());
    pbMessage.setClientid(
      message.clientId ? message.clientId : this.clientOptions.clientId,
    );
    pbMessage.setChannel(message.channel);
    pbMessage.setBody(message.body);
    pbMessage.setMetadata(message.metadata);
    if (message.tags != null) {
      pbMessage.getTagsMap().set(message.tags);
    }
    if (message.policy != null) {
      pbMessage
        .getPolicy()
        .setDelayseconds(
          message.policy.delaySeconds ? message.policy.delaySeconds : 0,
        );
      pbMessage
        .getPolicy()
        .setExpirationseconds(
          message.policy.expirationSeconds
            ? message.policy.expirationSeconds
            : 0,
        );
      pbMessage
        .getPolicy()
        .setMaxreceivecount(
          message.policy.maxReceiveCount ? message.policy.maxReceiveCount : 0,
        );
      pbMessage
        .getPolicy()
        .setMaxreceivequeue(
          message.policy.maxReceiveQueue ? message.policy.maxReceiveQueue : '',
        );
    }
    return new Promise<QueueMessageSendResult>((resolve, reject) => {
      this.grpcClient.sendQueueMessage(
        pbMessage,
        this.metadata(),
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
  public batch(messages: QueueMessage[]): Promise<QueueMessageSendResult[]> {
    const pbBatchRequest = new pb.QueueMessagesBatchRequest();
    pbBatchRequest.setBatchid(Utils.uuid());
    messages.forEach((message) => {
      const pbMessage = new pb.QueueMessage();
      pbMessage.setMessageid(message.id ? message.id : Utils.uuid());
      pbMessage.setClientid(
        message.clientId ? message.clientId : this.clientOptions.clientId,
      );
      pbMessage.setChannel(message.channel);
      pbMessage.setBody(message.body);
      pbMessage.setMetadata(message.metadata);
      if (message.tags != null) {
        pbMessage.getTagsMap().set(message.tags);
      }
      if (message.policy != null) {
        pbMessage
          .getPolicy()
          .setDelayseconds(
            message.policy.delaySeconds ? message.policy.delaySeconds : 0,
          );
        pbMessage
          .getPolicy()
          .setExpirationseconds(
            message.policy.expirationSeconds
              ? message.policy.expirationSeconds
              : 0,
          );
        pbMessage
          .getPolicy()
          .setMaxreceivecount(
            message.policy.maxReceiveCount ? message.policy.maxReceiveCount : 0,
          );
        pbMessage
          .getPolicy()
          .setMaxreceivequeue(
            message.policy.maxReceiveQueue
              ? message.policy.maxReceiveQueue
              : '',
          );
      }
      pbBatchRequest.getMessagesList().push(pbMessage);
    });
    return new Promise<QueueMessageSendResult[]>((resolve, reject) => {
      this.grpcClient.sendQueueMessagesBatch(
        pbBatchRequest,
        this.metadata(),
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
  public pull(
    request: QueuesPullMessagesRequest,
  ): Promise<QueuesPullMessagesResponse> {
    return this.pullOrPeek(request, false);
  }
  public peek(
    request: QueuesPullMessagesRequest,
  ): Promise<QueuesPullMessagesResponse> {
    return this.pullOrPeek(request, true);
  }
  private pullOrPeek(
    request: QueuesPullMessagesRequest,
    isPeek: boolean,
  ): Promise<QueuesPullMessagesResponse> {
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
    pbPullSubRequest.setMaxnumberofmessages(
      request.waitTimeout ? request.waitTimeout : 0,
    );
    pbPullSubRequest.setIspeak(isPeek);

    return new Promise<QueuesPullMessagesResponse>((resolve, reject) => {
      this.grpcClient.receiveQueueMessages(
        pbPullSubRequest,
        this.metadata(),
        (e, response) => {
          if (e) {
            reject(e);
            return;
          }
          const respMessages: QueueMessage[] = [];
          response.getMessagesList().forEach((message) => {
            let messageAttributes: QueuesMessageAttributes;
            if (message.getAttributes() != null) {
              messageAttributes.delayedTo = message
                .getAttributes()
                .getDelayedto();
              messageAttributes.expirationAt = message
                .getAttributes()
                .getExpirationat();
              messageAttributes.receiveCount = message
                .getAttributes()
                .getReceivecount();
              messageAttributes.reRouted = message
                .getAttributes()
                .getRerouted();
              messageAttributes.reRoutedFromQueue = message
                .getAttributes()
                .getReroutedfromqueue();
              messageAttributes.sequence = message
                .getAttributes()
                .getSequence();
              messageAttributes.timestamp = message
                .getAttributes()
                .getTimestamp();
            }
            respMessages.push({
              id: message.getMessageid(),
              channel: message.getChannel(),
              clientId: message.getClientid(),
              metadata: message.getMetadata(),
              body: message.getBody(),
              tags: message.getTagsMap(),
              attributes: messageAttributes,
            });
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

  public ackAll(
    request: QueuesAckAllMessagesRequest,
  ): Promise<QueuesAckAllMessagesResponse> {
    const pbMessage = new pb.AckAllQueueMessagesRequest();
    pbMessage.setRequestid(request.id ? request.id : Utils.uuid());
    pbMessage.setClientid(
      request.clientId ? request.clientId : this.clientOptions.clientId,
    );
    pbMessage.setChannel(request.channel);
    pbMessage.setWaittimeseconds(request.waitTimeout ? request.waitTimeout : 0);
    return new Promise<QueuesAckAllMessagesResponse>((resolve, reject) =>
      this.grpcClient.ackAllQueueMessages(
        pbMessage,
        this.metadata(),
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
}
