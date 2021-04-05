import { BaseMessage, Client } from './client';
import { Config } from './config';
import * as pb from '../src/protos';
import { Utils } from './utils';
import * as grpc from '@grpc/grpc-js';

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
  msgsReceived: number;
  msgsExpired: number;
  isPeek: boolean;
  isError: boolean;
  error: string;
}

export interface QueuesAckAllMessagesRequest {
  id?: string;
  channel: string;
  clientId?: string;
  waitTimeoutSeconds: number;
}

export interface QueuesAckAllMessagesResponse {
  id?: string;
  affectedMessages: number;
  isError: boolean;
  error: string;
}

export interface QueueTransactionRequest {
  channel: string;
  clientId?: string;
  visibilitySeconds: number;
  waitTimoutSeconds: number;
}
export interface QueueTransactionCallback {
  (err: Error | null, msg: QueueTransactionMessage): void;
}
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
export class QueuesClient extends Client {
  constructor(Options: Config) {
    super(Options);
  }

  public send(msg: QueueMessage): Promise<QueueMessageSendResult> {
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
  public batch(messages: QueueMessage[]): Promise<QueueMessageSendResult[]> {
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
    pbPullSubRequest.setWaittimeseconds(
      request.waitTimeout ? request.waitTimeout : 0,
    );
    pbPullSubRequest.setIspeak(isPeek);
    return new Promise<QueuesPullMessagesResponse>((resolve, reject) => {
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
            msgsExpired: response.getMessagesexpired(),
            msgsReceived: response.getMessagesreceived(),
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

export class QueueTransactionMessage {
  constructor(
    private _stream: grpc.ClientDuplexStream<
      pb.StreamQueueMessagesRequest,
      pb.StreamQueueMessagesResponse
    >,
    public message: QueueMessage,
  ) {}

  public ack(): Promise<void> {
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
  public reject(): Promise<void> {
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

  public extendVisibility(newVisibilitySeconds: number): Promise<void> {
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
  public resendNewMessage(msg: QueueMessage): Promise<void> {
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
  public resendToChannel(channel: string): Promise<void> {
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
