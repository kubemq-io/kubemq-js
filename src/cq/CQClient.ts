// commandsClient.ts

import { TypedEvent,KubeMQClient } from '../client/KubeMQClient';
import { Config } from '../client/config';
import * as pb from '../protos';
import { Utils } from '../common/utils';
import * as grpc from '@grpc/grpc-js';
import { createChannel, deleteChannel, listCQChannels } from '../common/common';
import { CQChannel } from '../common/channel_stats';
import { QueriesMessage, QueriesResponse, QueriesSubscriptionRequest, QueriesReceiveMessageCallback, QueriesSubscriptionResponse } from './queryTypes';
import {
  CommandsMessage,
  CommandsResponse,
  CommandsReceiveMessageCallback,
  CommandsSubscriptionRequest,
  CommandsSubscriptionResponse,
} from './commandTypes';

interface InternalCommandsSubscriptionResponse {
    onClose: TypedEvent<void>;
    stream: grpc.ClientReadableStream<pb.kubemq.Request>;
  }

interface internalQueriesSubscriptionResponse {
  /** emit events on close subscription*/
  onClose: TypedEvent<void>;
  /** call stream*/
  stream: grpc.ClientReadableStream<pb.kubemq.Request>;
}

export class CQClient extends KubeMQClient {
  constructor(Options: Config) {
    super(Options);
  }

  sendCommandRequest(msg: CommandsMessage): Promise<CommandsResponse> {
    const pbMessage = new pb.kubemq.Request();
    pbMessage.RequestID=(msg.id ? msg.id : Utils.uuid());
    pbMessage.ClientID=(msg.clientId ? msg.clientId : this.clientId);

    if (!msg.channel || msg.channel.trim().length === 0) {
      throw new Error('Command message must have a channel.');
    }
    pbMessage.Channel=(msg.channel);
    pbMessage.ReplyChannel=(msg.channel);

    if (
      (!msg.metadata || msg.metadata.trim().length === 0) &&
      (!msg.body || msg.body.length === 0) &&
      (!msg.tags || msg.tags.size === 0)
    ) {
      throw new Error('Command message must have at least one of the following: metadata, body, or tags.');
    }
    //pbMessage.setBody(msg.body);
    pbMessage.Body = typeof msg.body === 'string' ? new TextEncoder().encode(msg.body) : msg.body;
    pbMessage.Metadata=(msg.metadata);
    if (msg.tags != null) {
      pbMessage.Tags=(msg.tags);
    }

    if (msg.timeout <= 0) {
      throw new Error('Command message timeout must be a positive integer.');
    }
    pbMessage.Timeout=(msg.timeout);
    pbMessage.RequestTypeData= pb.kubemq.Request.RequestType.Command;

    return new Promise<CommandsResponse>((resolve, reject) => {
      this.grpcClient.SendRequest(
        pbMessage,
        this.getMetadata(),
        (e, response) => {
          if (e) {
            reject(e);
            return;
          }
          resolve({
            id: response.RequestID,
            clientId: response.ClientID,
            error: response.Error,
            executed: response.Executed,
            timestamp: response.Timestamp,
          });
        },
      );
    });
  }

  sendQueryRequest(msg: QueriesMessage): Promise<QueriesResponse> {
    const pbMessage = new pb.kubemq.Request();
    pbMessage.RequestID=(msg.id ? msg.id : Utils.uuid());
    pbMessage.ClientID=(msg.clientId ? msg.clientId : this.clientId);
    pbMessage.Channel=(msg.channel);
    pbMessage.ReplyChannel=(msg.channel);
    //pbMessage.setBody(msg.body);
    pbMessage.Body = typeof msg.body === 'string' ? new TextEncoder().encode(msg.body) : msg.body;
    pbMessage.Metadata=(msg.metadata);
    if (msg.tags != null) {
      pbMessage.Tags=(msg.tags);
    }
    pbMessage.Timeout=(msg.timeout);
    pbMessage.RequestTypeData=(2);
    pbMessage.CacheKey=(msg.cacheKey ? msg.cacheKey : '');
    pbMessage.CacheTTL=(msg.cacheTTL ? msg.cacheTTL : 0);

    return new Promise<QueriesResponse>((resolve, reject) => {
      this.grpcClient.SendRequest(
        pbMessage,
        this.getMetadata(),
        (e, response) => {
          if (e) {
            reject(e);
            return;
          }
          resolve({
            id: response.RequestID,
            clientId: response.ClientID,
            error: response.Error,
            executed: response.Executed,
            timestamp: response.Timestamp,
            body: response.Body,
            metadata: response.Metadata,
            tags: response.Tags,
          });
        },
      );
    });
  }

  sendCommandResponseMessage(msg: CommandsResponse): Promise<void> {
    const pbMessage = new pb.kubemq.Response();
    pbMessage.RequestID=(msg.id);
    pbMessage.ClientID=(msg.clientId ? msg.clientId : this.clientId);
    pbMessage.ReplyChannel=(msg.replyChannel);
    pbMessage.Error=(msg.error);
    pbMessage.Executed=(msg.executed);
    return new Promise<void>((resolve, reject) => {
      this.grpcClient.SendResponse(pbMessage, this.getMetadata(), (e) => {
        if (e) {
          reject(e);
          return;
        }
        resolve();
      });
    });
  }

  sendQueryResponseMessage(msg: QueriesResponse): Promise<void> {
    const pbMessage = new pb.kubemq.Response();
    pbMessage.RequestID=(msg.id);
    pbMessage.ClientID=(msg.clientId ? msg.clientId : this.clientId);
    pbMessage.ReplyChannel=(msg.replyChannel);
    pbMessage.Error=(msg.error);
    pbMessage.Executed=(msg.executed);
    pbMessage.Body = typeof msg.body === 'string' ? new TextEncoder().encode(msg.body) : msg.body;
    //pbMessage.setBody(msg.body);
    pbMessage.Metadata=(msg.metadata);
    if (msg.tags != null) {
      pbMessage.Tags=(msg.tags);
    }

    return new Promise<void>((resolve, reject) => {
      this.grpcClient.SendResponse(pbMessage, this.getMetadata(), (e) => {
        if (e) {
          reject(e);
          return;
        }
        resolve();
      });
    });
  }

  createCommandsChannel(channelName: string): Promise<void> {
    return createChannel(
      this.grpcClient,
      this.getMetadata(),
      this.clientId,
      channelName,
      'commands',
    );
  }

  createQueriesChannel(channelName: string): Promise<void> {
    return createChannel(
      this.grpcClient,
      this.getMetadata(),
      this.clientId,
      channelName,
      'queries',
    );
  }

  deleteCommandsChannel(channelName: string): Promise<void> {
    return deleteChannel(
      this.grpcClient,
      this.getMetadata(),
      this.clientId,
      channelName,
      'commands',
    );
  }

  deleteQueriesChannel(channelName: string): Promise<void> {
    return deleteChannel(
      this.grpcClient,
      this.getMetadata(),
      this.clientId,
      channelName,
      'queries',
    );
  }

  listCommandsChannels(search: string): Promise<CQChannel[]> {
    return listCQChannels(
      this.grpcClient,
      this.getMetadata(),
      this.clientId,
      search,
      'commands',
    );
  }


  listQueriesChannels(search: string): Promise<CQChannel[]> {
    return listCQChannels(
      this.grpcClient,
      this.getMetadata(),
      this.clientId,
      search,
      'queries',
    );
  }

  async subscribeToCommands(
    request: CommandsSubscriptionRequest,
    cb: CommandsReceiveMessageCallback,
  ): Promise<CommandsSubscriptionResponse> {
    return new Promise<CommandsSubscriptionResponse>(
      async (resolve, reject) => {
        if (!request) {
          reject(new Error('commands subscription requires a request object'));
          return;
        }
        if (request.channel === '') {
          reject(new Error('commands subscription requires a non empty request channel'));
          return;
        }
        if (!cb) {
          reject(new Error('commands subscription requires a callback'));
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
          await this.subscribeFnCommand(request, cb).then((value) => {
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
      },
    );
  }

  private subscribeFnCommand(
    request: CommandsSubscriptionRequest,
    cb: CommandsReceiveMessageCallback,
  ): Promise<InternalCommandsSubscriptionResponse> {
    return new Promise<InternalCommandsSubscriptionResponse>(
      (resolve, reject) => {
        if (!cb) {
          reject(new Error('commands subscription requires a callback'));
          return;
        }

        const pbSubRequest = new pb.kubemq.Subscribe();
        pbSubRequest.ClientID=(request.clientId ? request.clientId : this.clientId);
        pbSubRequest.Group=(request.group ? request.group : '');
        pbSubRequest.Channel=(request.channel);
        pbSubRequest.SubscribeTypeData=(3);
        const stream = this.grpcClient.SubscribeToRequests(pbSubRequest, this.getMetadata());

        stream.on('data', function (data: pb.kubemq.Request) {
          cb(null, {
            id: data.RequestID,
            channel: data.Channel,
            metadata: data.Metadata,
            body: data.Body,
            tags: data.Tags,
            replyChannel: data.ReplyChannel,
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



  async subscribeToQueries(request: QueriesSubscriptionRequest, cb: QueriesReceiveMessageCallback): Promise<QueriesSubscriptionResponse> {
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
        await this.subscribeFnQueries(request, cb).then((value) => {
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

  private subscribeFnQueries(request: QueriesSubscriptionRequest, cb: QueriesReceiveMessageCallback): Promise<internalQueriesSubscriptionResponse> {
    return new Promise<internalQueriesSubscriptionResponse>((resolve, reject) => {
      if (!cb) {
        reject(new Error('queries subscription requires a callback'));
        return;
      }

      const pbSubRequest = new pb.kubemq.Subscribe();
      pbSubRequest.ClientID=(request.clientId ? request.clientId : this.clientId);
      pbSubRequest.Group=(request.group ? request.group : '');
      pbSubRequest.Channel=(request.channel);
      pbSubRequest.SubscribeTypeData= pb.kubemq.Subscribe.SubscribeType.Queries;

      const stream = this.grpcClient.SubscribeToRequests(pbSubRequest, this.getMetadata());

      stream.on('data', function (data: pb.kubemq.Request) {
        cb(null, {
          id: data.RequestID,
          channel: data.Channel,
          metadata: data.Metadata,
          body: data.Body,
          tags: data.Tags,
          replyChannel: data.ReplyChannel,
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

}


