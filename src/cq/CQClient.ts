import { TypedEvent, KubeMQClient } from '../client/KubeMQClient';
import { Config } from '../client/config';
import * as pb from '../protos';
import { Utils } from '../common/utils';
import * as grpc from '@grpc/grpc-js';
import { createChannel, deleteChannel, listCQChannels } from '../common/common';
import { CQChannel } from '../common/channel_stats';
import { QueriesMessage, QueriesResponse, QueriesSubscriptionRequest, QueryMessageReceived } from './queryTypes';
import {
  CommandsMessage,
  CommandsResponse,
  CommandsSubscriptionRequest,
  CommandMessageReceived,
} from './commandTypes';

export class CQClient extends KubeMQClient {
  constructor(Options: Config) {
    super(Options);
  }

  private encodeBody(body: Uint8Array | string): Uint8Array {
    return typeof body === 'string' ? new TextEncoder().encode(body) : body;
  }

  private handleGrpcResponse<T>(resolve: (value: T) => void, reject: (reason?: any) => void) {
    return (e: grpc.ServiceError | null, response: any) => {
      if (e) {
        reject(e);
        return;
      }
      resolve(response);
    };
  }

  sendCommandRequest(msg: CommandsMessage): Promise<CommandsResponse> {
    const pbMessage = new pb.kubemq.Request();
    pbMessage.RequestID = msg.id || Utils.uuid();
    pbMessage.ClientID = msg.clientId || this.clientId;
    pbMessage.Channel = msg.channel;
    pbMessage.ReplyChannel = msg.channel;
    pbMessage.Body = this.encodeBody(msg.body);
    pbMessage.Metadata = msg.metadata;
    if (msg.tags) {
      pbMessage.Tags = msg.tags;
    }

    if (!msg.channel || msg.channel.trim().length === 0) {
      throw new Error('Command message must have a channel.');
    }

    if (!msg.metadata && !msg.body && !msg.tags?.size) {
      throw new Error('Command message must have at least one of the following: metadata, body, or tags.');
    }

    if (msg.timeout == null || msg.timeout <= 0) {
      throw new Error('Command message timeout must be a positive integer.');
    }

    pbMessage.Timeout = msg.timeout;
    pbMessage.RequestTypeData = pb.kubemq.Request.RequestType.Command;

    return new Promise<CommandsResponse>((resolve, reject) => {
      this.grpcClient.SendRequest(pbMessage, this.getMetadata(), this.handleGrpcResponse(resolve, reject));
    }).then(response => ({
      id: response.id,
      clientId: response.clientId,
      error: response.error,
      executed: response.executed,
      timestamp: response.timestamp,
    }));
  }

  sendQueryRequest(msg: QueriesMessage): Promise<QueriesResponse> {
    const pbMessage = new pb.kubemq.Request();
    pbMessage.RequestID = msg.id || Utils.uuid();
    pbMessage.ClientID = msg.clientId || this.clientId;
    pbMessage.Channel = msg.channel;
    pbMessage.ReplyChannel = msg.channel;
    pbMessage.Body = this.encodeBody(msg.body);
    pbMessage.Metadata = msg.metadata;
    if (msg.tags) {
      pbMessage.Tags = msg.tags;
    }
    pbMessage.Timeout = msg.timeout;
    pbMessage.RequestTypeData = pb.kubemq.Request.RequestType.Query;
    pbMessage.CacheKey = msg.cacheKey || '';
    pbMessage.CacheTTL = msg.cacheTTL || 0;

    return new Promise<QueriesResponse>((resolve, reject) => {
      this.grpcClient.SendRequest(pbMessage, this.getMetadata(), this.handleGrpcResponse(resolve, reject));
    }).then(response => ({
      id: response.id,
      clientId: response.clientId,
      error: response.error,
      executed: response.executed,
      timestamp: response.timestamp,
      body: response.body,
      metadata: response.metadata,
      tags: response.tags,
    }));
  }

  sendCommandResponseMessage(msg: CommandsResponse): Promise<void> {
    const pbMessage = new pb.kubemq.Response();
    pbMessage.RequestID = msg.id;
    pbMessage.ClientID = msg.clientId || this.clientId;
    pbMessage.ReplyChannel = msg.replyChannel;
    pbMessage.Error = msg.error;
    pbMessage.Executed = msg.executed;

    return new Promise<void>((resolve, reject) => {
      this.grpcClient.SendResponse(pbMessage, this.getMetadata(), this.handleGrpcResponse(resolve, reject));
    });
  }

  sendQueryResponseMessage(msg: QueriesResponse): Promise<void> {
    const pbMessage = new pb.kubemq.Response();
    pbMessage.RequestID = msg.id;
    pbMessage.ClientID = msg.clientId || this.clientId;
    pbMessage.ReplyChannel = msg.replyChannel;
    pbMessage.Error = msg.error;
    pbMessage.Executed = msg.executed;
    pbMessage.Body = this.encodeBody(msg.body);
    pbMessage.Metadata = msg.metadata;
    if (msg.tags) {
      pbMessage.Tags = msg.tags;
    }

    return new Promise<void>((resolve, reject) => {
      this.grpcClient.SendResponse(pbMessage, this.getMetadata(), this.handleGrpcResponse(resolve, reject));
    });
  }

  createCommandsChannel(channelName: string): Promise<void> {
    return createChannel(this.grpcClient, this.getMetadata(), this.clientId, channelName, 'commands');
  }

  createQueriesChannel(channelName: string): Promise<void> {
    return createChannel(this.grpcClient, this.getMetadata(), this.clientId, channelName, 'queries');
  }

  deleteCommandsChannel(channelName: string): Promise<void> {
    return deleteChannel(this.grpcClient, this.getMetadata(), this.clientId, channelName, 'commands');
  }

  deleteQueriesChannel(channelName: string): Promise<void> {
    return deleteChannel(this.grpcClient, this.getMetadata(), this.clientId, channelName, 'queries');
  }

  listCommandsChannels(search: string): Promise<CQChannel[]> {
    return listCQChannels(this.grpcClient, this.getMetadata(), this.clientId, search, 'commands');
  }

  listQueriesChannels(search: string): Promise<CQChannel[]> {
    return listCQChannels(this.grpcClient, this.getMetadata(), this.clientId, search, 'queries');
  }

  public async subscribeToCommands(request: CommandsSubscriptionRequest): Promise<void> {
    try {
      console.debug('Subscribing to Command');
      request.validate();

      const subscribe = request.encode(this);
      const stream = this.grpcClient.SubscribeToRequests(subscribe, this.getMetadata());
      request.observer = stream;

      stream.on('data', (data: pb.kubemq.Request) => {
        console.debug(`Command Message received: ID='${data.RequestID}', Channel='${data.Channel}'`);
        const event = CommandMessageReceived.decode(data);
        request.raiseOnReceiveMessage(event);
      });

      stream.on('error', (err: grpc.ServiceError) => {
        console.error('Command Subscription error:', err.message, 'Code:', err.code);
        request.raiseOnError(err.message);
        if (err.code === grpc.status.UNAVAILABLE) {
          console.debug('Server is unavailable, attempting to reconnect...');
          request.reconnect(this, this.reconnectIntervalSeconds);
        }
      });

      stream.on('close', () => {
        console.debug('Stream closed by the server, attempting to reconnect...');
        request.reconnect(this, this.reconnectIntervalSeconds);
      });
    } catch (error) {
      console.error('Failed to subscribe to commands', error);
      throw new Error('Subscription failed');
    }
  }

  public async subscribeToQueries(request: QueriesSubscriptionRequest): Promise<void> {
    try {
      console.debug('Subscribing to queries');
      request.validate();

      const subscribe = request.encode(this);
      const stream = this.grpcClient.SubscribeToRequests(subscribe, this.getMetadata());
      request.observer = stream;

      stream.on('data', (data: pb.kubemq.Request) => {
        console.debug(`Queries Message received: ID='${data.RequestID}', Channel='${data.Channel}'`);
        const event = QueryMessageReceived.decode(data);
        request.raiseOnReceiveMessage(event);
      });

      stream.on('error', (err: grpc.ServiceError) => {
        console.error('Queries Subscription error:', err.message, 'Code:', err.code);
        request.raiseOnError(err.message);
        if (err.code === grpc.status.UNAVAILABLE) {
          console.debug('Server is unavailable, attempting to reconnect...');
          request.reconnect(this, this.reconnectIntervalSeconds);
        }
      });

      stream.on('close', () => {
        console.debug('Stream closed by the server, attempting to reconnect...');
        request.reconnect(this, this.reconnectIntervalSeconds);
      });
    } catch (error) {
      console.error('Failed to subscribe to queries', error);
      throw new Error('Subscription failed');
    }
  }
}
