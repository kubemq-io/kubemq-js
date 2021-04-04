import { BaseMessage, Client, StreamState } from './client';
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

export interface QueriesSubscriptionResponse {
  state: StreamState;
  onQuery: TypedEvent<QueriesReceiveMessage>;
  onError: TypedEvent<Error>;
  onStateChanged: TypedEvent<StreamState>;
  cancel(): void;
}

export class QueriesClient extends Client {
  constructor(Options: Config) {
    super(Options);
  }

  public send(message: QueriesMessage): Promise<QueriesResponse> {
    const pbMessage = new pb.Request();
    pbMessage.setRequestid(message.id ? message.id : Utils.uuid());
    pbMessage.setClientid(
      message.clientId ? message.clientId : this.clientOptions.clientId,
    );
    pbMessage.setChannel(message.channel);
    pbMessage.setReplychannel(message.channel);
    pbMessage.setBody(message.body);
    pbMessage.setMetadata(message.metadata);
    if (message.tags != null) {
      pbMessage.getTagsMap().set(message.tags);
    }
    pbMessage.setTimeout(
      message.timeout ? message.timeout : this.clientOptions.defaultRpcTimeout,
    );
    pbMessage.setRequesttypedata(2);
    pbMessage.setCachekey(message.cacheKey ? message.cacheKey : '');
    pbMessage.setCachettl(message.cacheTTL ? message.cacheTTL : 0);
    return new Promise<QueriesResponse>((resolve, reject) => {
      this.grpcClient.sendRequest(pbMessage, this.metadata(), (e, response) => {
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
      });
    });
  }

  public response(message: QueriesResponse): Promise<void> {
    const pbMessage = new pb.Response();
    pbMessage.setRequestid(message.id);
    pbMessage.setClientid(
      message.clientId ? message.clientId : this.clientOptions.clientId,
    );
    pbMessage.setReplychannel(message.replyChannel);
    pbMessage.setError(message.error);
    pbMessage.setExecuted(message.executed);
    pbMessage.setBody(message.body);
    pbMessage.setMetadata(message.metadata);
    if (message.tags != null) {
      pbMessage.getTagsMap().set(message.tags);
    }
    return new Promise<void>((resolve, reject) => {
      this.grpcClient.sendResponse(pbMessage, this.metadata(), (e) => {
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
  ): Promise<QueriesSubscriptionResponse> {
    return new Promise<QueriesSubscriptionResponse>((resolve, reject) => {
      try {
        const pbSubRequest = new pb.Subscribe();
        pbSubRequest.setClientid(
          request.clientId ? request.clientId : this.clientOptions.clientId,
        );
        pbSubRequest.setGroup(request.group ? request.group : '');
        pbSubRequest.setChannel(request.channel);
        pbSubRequest.setSubscribetypedata(4);

        const stream = this.grpcClient.subscribeToRequests(
          pbSubRequest,
          this.metadata(),
        );

        let state = StreamState.Initialized;
        let onStateChanged = new TypedEvent<StreamState>();
        let onQuery = new TypedEvent<QueriesReceiveMessage>();
        let onError = new TypedEvent<Error>();

        stream.on('data', function (data: pb.Request) {
          onQuery.emit({
            id: data.getRequestid(),
            channel: data.getChannel(),
            metadata: data.getMetadata(),
            body: data.getBody(),
            tags: data.getTagsMap(),
            replyChannel: data.getReplychannel(),
          });
          if (state !== StreamState.Ready) {
            state = StreamState.Ready;
            onStateChanged.emit(StreamState.Ready);
          }
        });
        stream.on('error', function (e: Error) {
          onError.emit(e);
          if (state !== StreamState.Error) {
            state = StreamState.Error;
            onStateChanged.emit(StreamState.Error);
          }
        });

        stream.on('close', function () {
          if (state !== StreamState.Closed) {
            state = StreamState.Closed;
            onStateChanged.emit(StreamState.Closed);
          }
        });
        resolve({
          state: state,
          onQuery: onQuery,
          onStateChanged: onStateChanged,
          onError: onError,
          cancel() {
            stream.cancel();
          },
        });
      } catch (e) {
        reject(e);
      }
    });
  }
}
