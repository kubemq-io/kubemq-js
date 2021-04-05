import { BaseMessage, Client } from './client';
import { Config } from './config';
import * as pb from '../src/protos';
import { Utils } from './utils';
import { TypedEvent } from './common';

export interface QueriesMessage extends BaseMessage {
  timeout?: number;
  cacheKey?: string;
  cacheTTL?: number;
}
export interface QueriesReceiveMessage {
  id: string;
  channel: string;
  metadata: string;
  body: Uint8Array | string;
  tags: Map<string, string>;
  replyChannel: string;
}

export interface QueriesResponse {
  id: string;
  replyChannel?: string;
  clientId: string;
  metadata?: string;
  body?: Uint8Array | string;
  tags?: Map<string, string>;
  timestamp: number;
  executed: boolean;
  error: string;
}

export interface QueriesSubscriptionRequest {
  channel: string;
  group?: string;
  clientId?: string;
}
export interface QueriesReceiveMessageCallback {
  (err: Error | null, msg: QueriesReceiveMessage): void;
}
export interface QueriesSubscriptionResponse {
  onClose: TypedEvent<void>;
  unsubscribe(): void;
}

export class QueriesClient extends Client {
  constructor(Options: Config) {
    super(Options);
  }

  public send(msg: QueriesMessage): Promise<QueriesResponse> {
    const pbMessage = new pb.Request();
    pbMessage.setRequestid(msg.id ? msg.id : Utils.uuid());
    pbMessage.setClientid(
      msg.clientId ? msg.clientId : this.clientOptions.clientId,
    );
    pbMessage.setChannel(msg.channel);
    pbMessage.setReplychannel(msg.channel);
    pbMessage.setBody(msg.body);
    pbMessage.setMetadata(msg.metadata);
    if (msg.tags != null) {
      pbMessage.getTagsMap().set(msg.tags);
    }
    pbMessage.setTimeout(
      msg.timeout ? msg.timeout : this.clientOptions.defaultRpcTimeout,
    );
    pbMessage.setRequesttypedata(2);
    pbMessage.setCachekey(msg.cacheKey ? msg.cacheKey : '');
    pbMessage.setCachettl(msg.cacheTTL ? msg.cacheTTL : 0);
    return new Promise<QueriesResponse>((resolve, reject) => {
      this.grpcClient.sendRequest(
        pbMessage,
        this.getMetadata(),
        (e, response) => {
          if (e) {
            reject(e);
            return;
          }
          resolve({
            id: response.getRequestid(),
            clientId: response.getClientid(),
            error: response.getError(),
            executed: response.getExecuted(),
            timestamp: response.getTimestamp(),
            body: response.getBody(),
            metadata: response.getMetadata(),
            tags: response.getTagsMap(),
          });
        },
      );
    });
  }

  public response(msg: QueriesResponse): Promise<void> {
    const pbMessage = new pb.Response();
    pbMessage.setRequestid(msg.id);
    pbMessage.setClientid(
      msg.clientId ? msg.clientId : this.clientOptions.clientId,
    );
    pbMessage.setReplychannel(msg.replyChannel);
    pbMessage.setError(msg.error);
    pbMessage.setExecuted(msg.executed);
    pbMessage.setBody(msg.body);
    pbMessage.setMetadata(msg.metadata);
    if (msg.tags != null) {
      pbMessage.getTagsMap().set(msg.tags);
    }
    return new Promise<void>((resolve, reject) => {
      this.grpcClient.sendResponse(pbMessage, this.getMetadata(), (e) => {
        if (e) {
          reject(e);
          return;
        }
        resolve();
      });
    });
  }

  public subscribe(
    request: QueriesSubscriptionRequest,
    cb: QueriesReceiveMessageCallback,
  ): Promise<QueriesSubscriptionResponse> {
    return new Promise<QueriesSubscriptionResponse>((resolve, reject) => {
      if (!cb) {
        reject(new Error('queries subscription requires a callback'));
        return;
      }

      const pbSubRequest = new pb.Subscribe();
      pbSubRequest.setClientid(
        request.clientId ? request.clientId : this.clientOptions.clientId,
      );
      pbSubRequest.setGroup(request.group ? request.group : '');
      pbSubRequest.setChannel(request.channel);
      pbSubRequest.setSubscribetypedata(4);

      const stream = this.grpcClient.subscribeToRequests(
        pbSubRequest,
        this.getMetadata(),
      );

      stream.on('data', function (data: pb.Request) {
        cb(null, {
          id: data.getRequestid(),
          channel: data.getChannel(),
          metadata: data.getMetadata(),
          body: data.getBody(),
          tags: data.getTagsMap(),
          replyChannel: data.getReplychannel(),
        });
      });
      stream.on('error', (e: Error) => {
        cb(e, null);
      });

      let onClose = new TypedEvent<void>();
      stream.on('close', () => {
        onClose.emit();
      });
      resolve({
        onClose: onClose,
        unsubscribe() {
          stream.cancel();
        },
      });
    });
  }
}
