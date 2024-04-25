import { BaseMessage, Client, TypedEvent } from './client';
import { Config } from './config';
import * as pb from './protos';
import { Utils } from './utils';
import * as grpc from '@grpc/grpc-js';
import { createChannel, deleteChannel, listCQChannels } from './common';
import { CQChannel } from './channel_stats';

/**
 * queries request base message
 */
export interface QueriesMessage extends BaseMessage {
  timeout?: number;
  cacheKey?: string;
  cacheTTL?: number;
}

/**
 * query request received by queries subscriber
 */
export interface QueriesReceiveMessage {
  /** send query request id */
  id: string;

  /** channel name */
  channel: string;

  /** query request metadata */
  metadata: string;

  /** query request payload */
  body: Uint8Array | string;

  /** query request key/value tags */
  tags: Map<string, string>;

  /** query request replay channel for response */
  replyChannel: string;
}

/**
 * query response
 */
export interface QueriesResponse {
  /** send command request id */
  id: string;

  /** query response replay channel*/
  replyChannel?: string;

  /** clientId name of the responder*/
  clientId: string;

  /** response timestamp in Unix Epoch time*/
  timestamp: number;

  /** indicates execution of the query request*/
  executed: boolean;

  /** execution error if present*/
  error: string;

  /** response metadata*/
  metadata?: string;

  /** response payload*/
  body?: Uint8Array | string;

  /** response key/value tags*/
  tags?: Map<string, string>;
}

/** query requests subscription */
export interface QueriesSubscriptionRequest {
  /** query requests channel */
  channel: string;

  /** query requests channel group*/
  group?: string;

  /** query requests clientId */
  clientId?: string;
}

/** queries requests subscription callback */
export interface QueriesReceiveMessageCallback {
  (err: Error | null, msg: QueriesReceiveMessage): void;
}
/**
 * @internal
 */
interface internalQueriesSubscriptionResponse {
  /** emit events on close subscription*/
  onClose: TypedEvent<void>;

  /** call stream*/
  stream: grpc.ClientReadableStream<pb.Request>;
}

/** queries requests subscription response*/
export interface QueriesSubscriptionResponse {
  onState: TypedEvent<string>;
  /** call unsubscribe*/
  unsubscribe(): void;
}
/**
 * Queries Client - KubeMQ queries client
 */
export class QueriesClient extends Client {
  /**
   * @internal
   */
  constructor(Options: Config) {
    super(Options);
  }
  /**
   * Send query request to server and waits for response
   * @param msg
   * @return Promise<QueriesResponse>
   */
  send(msg: QueriesMessage): Promise<QueriesResponse> {
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
  /**
   * Send response for a query request to the server
   * @param msg
   * @return Promise<void>
   */
  response(msg: QueriesResponse): Promise<void> {
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

  /**
   * Subscribe to commands requests
   * @param request
   * @param cb
   * @return Promise<QueriesSubscriptionResponse>
   */

  async subscribe(
    request: QueriesSubscriptionRequest,
    cb: QueriesReceiveMessageCallback,
  ): Promise<QueriesSubscriptionResponse> {
    return new Promise<QueriesSubscriptionResponse>(async (resolve, reject) => {
      if (!request) {
        reject(new Error('queries subscription requires a request object'));
        return;
      }
      if (request.channel === '') {
        reject(
          new Error(
            'queries subscription requires a non empty request channel',
          ),
        );
        return;
      }
      if (!cb) {
        reject(new Error('queries subscription requires a callback'));
        return;
      }

      let isClosed = false;
      let unsubscribe = false;
      const onStateChange = new TypedEvent<string>();
      onStateChange.on((event) => {
        if (event === 'close') {
          isClosed = true;
          onStateChange.emit('disconnected');
        }
      });

      resolve({
        onState: onStateChange,
        unsubscribe() {
          unsubscribe = true;
        },
      });
      let currentStream;
      while (!unsubscribe) {
        onStateChange.emit('connecting');
        await this.subscribeFn(request, cb).then((value) => {
          currentStream = value.stream;
        });
        isClosed = false;
        onStateChange.emit('connected');
        while (!isClosed && !unsubscribe) {
          await new Promise((r) => setTimeout(r, 1000));
        }
        const reconnectionInterval = this.clientOptions.reconnectInterval;
        if (reconnectionInterval === 0) {
          unsubscribe = true;
        } else {
          await new Promise((r) => setTimeout(r, reconnectionInterval));
        }
      }
      currentStream.cancel();
    });
  }

  private subscribeFn(
    request: QueriesSubscriptionRequest,
    cb: QueriesReceiveMessageCallback,
  ): Promise<internalQueriesSubscriptionResponse> {
    return new Promise<internalQueriesSubscriptionResponse>(
      (resolve, reject) => {
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
          stream: stream,
        });
      },
    );
  }

  /**
   * Create a new query channel
   * @param channelName
   * @return Promise<void>
   */
  create(channelName: string): Promise<void> {
    return createChannel(
      this.grpcClient,
      this.getMetadata(),
      this.clientOptions.clientId,
      channelName,
      'queries',
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
      this.clientOptions.clientId,
      channelName,
      'queries',
    );
  }

  /**
   * List queries channels
   * @param search
   * @return Promise<CQChannel[]>
   */
  list(search: string): Promise<CQChannel[]> {
    return listCQChannels(
      this.grpcClient,
      this.getMetadata(),
      this.clientOptions.clientId,
      search,
      'queries',
    );
  }
}
