// src/queries/QueriesClient.ts

import { KubeMQClient,TypedEvent } from '../client/KubeMQClient';
import { Config } from '../client/config';
import * as pb from '../protos';
import * as grpc from '@grpc/grpc-js';
import { Utils } from '../common/utils';
import { createChannel, deleteChannel, listCQChannels } from '../common/common';
import { CQChannel } from '../common/channel_stats';
import { QueriesMessage, QueriesResponse, QueriesSubscriptionRequest, QueriesReceiveMessageCallback, QueriesSubscriptionResponse } from './queryTypes';

/**
 * @internal
 */
interface internalQueriesSubscriptionResponse {
  /** emit events on close subscription*/
  onClose: TypedEvent<void>;

  /** call stream*/
  stream: grpc.ClientReadableStream<pb.Request>;
}


export class QueriesClient extends KubeMQClient {
  constructor(Options: Config) {
    super(Options);
  }

  send(msg: QueriesMessage): Promise<QueriesResponse> {
    const pbMessage = new pb.Request();
    pbMessage.setRequestid(msg.id ? msg.id : Utils.uuid());
    pbMessage.setClientid(msg.clientId ? msg.clientId : this.clientId);
    pbMessage.setChannel(msg.channel);
    pbMessage.setReplychannel(msg.channel);
    pbMessage.setBody(msg.body);
    pbMessage.setMetadata(msg.metadata);
    if (msg.tags != null) {
      pbMessage.getTagsMap().set(msg.tags);
    }
    pbMessage.setTimeout(msg.timeout);
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

  response(msg: QueriesResponse): Promise<void> {
    const pbMessage = new pb.Response();
    pbMessage.setRequestid(msg.id);
    pbMessage.setClientid(msg.clientId ? msg.clientId : this.clientId);
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

  async subscribe(request: QueriesSubscriptionRequest, cb: QueriesReceiveMessageCallback): Promise<QueriesSubscriptionResponse> {
    return new Promise<QueriesSubscriptionResponse>(async (resolve, reject) => {
      if (!request) {
        reject(new Error('queries subscription requires a request object'));
        return;
      }
      if (request.channel === '') {
        reject(new Error('queries subscription requires a non empty request channel'));
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
        const reconnectionInterval = this.reconnectIntervalSeconds;
        if (reconnectionInterval === 0) {
          unsubscribe = true;
        } else {
          await new Promise((r) => setTimeout(r, reconnectionInterval));
        }
      }
      currentStream.cancel();
    });
  }

  private subscribeFn(request: QueriesSubscriptionRequest, cb: QueriesReceiveMessageCallback): Promise<internalQueriesSubscriptionResponse> {
    return new Promise<internalQueriesSubscriptionResponse>((resolve, reject) => {
      if (!cb) {
        reject(new Error('queries subscription requires a callback'));
        return;
      }

      const pbSubRequest = new pb.Subscribe();
      pbSubRequest.setClientid(request.clientId ? request.clientId : this.clientId);
      pbSubRequest.setGroup(request.group ? request.group : '');
      pbSubRequest.setChannel(request.channel);
      pbSubRequest.setSubscribetypedata(4);

      const stream = this.grpcClient.subscribeToRequests(pbSubRequest, this.getMetadata());

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
    });
  }

  create(channelName: string): Promise<void> {
    return createChannel(
      this.grpcClient,
      this.getMetadata(),
      this.clientId,
      channelName,
      'queries',
    );
  }

  delete(channelName: string): Promise<void> {
    return deleteChannel(
      this.grpcClient,
      this.getMetadata(),
      this.clientId,
      channelName,
      'queries',
    );
  }

  list(search: string): Promise<CQChannel[]> {
    return listCQChannels(
      this.grpcClient,
      this.getMetadata(),
      this.clientId,
      search,
      'queries',
    );
  }
}
