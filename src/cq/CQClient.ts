// commandsClient.ts

import { TypedEvent,KubeMQClient } from '../client/KubeMQClient';
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


  public async subscribeToCommands(request: CommandsSubscriptionRequest): Promise<void> {
    try {
        console.debug('Subscribing to Command');
        request.validate(); // Validate the request

        const subscribe = request.encode(this);
        const stream = this.grpcClient.SubscribeToRequests(subscribe, this.getMetadata());

        // Assign observer to the request
        request.observer = stream;

        // Command Message received
        stream.on('data', (data: pb.kubemq.Request) => {
            console.debug(`Command Message received: ID='${data.RequestID}', Channel='${data.Channel}'`);
            const event = CommandMessageReceived.decode(data);
            request.raiseOnReceiveMessage(event); // Process received event
        });

        // Handle errors (like server being unavailable)
        stream.on('error', (err: grpc.ServiceError) => {
            console.error('Command Subscription error:', err.message);
            console.error('Command Subscription error code:', err.code);

            request.raiseOnError(err.message);

            if (err.code === grpc.status.UNAVAILABLE) {
                console.debug('Server is unavailable, attempting to reconnect...');
                request.reconnect(this, this.reconnectIntervalSeconds); // Trigger reconnection
            }
        });

        // Handle stream close
        stream.on('close', () => {
            console.debug('Stream closed by the server, attempting to reconnect...');
            request.reconnect(this, this.reconnectIntervalSeconds); // Attempt to reconnect when the stream is closed
        });
    } catch (error) {
        console.error('Failed to subscribe to events', error);
        throw new Error('Subscription failed');
    }
}


public async subscribeToQueries(request: QueriesSubscriptionRequest): Promise<void> {
  try {
      console.debug('Subscribing to queries');
      request.validate(); // Validate the request

      const subscribe = request.encode(this);
      const stream = this.grpcClient.SubscribeToRequests(subscribe, this.getMetadata());

      // Assign observer to the request
      request.observer = stream;

      // Command Message received
      stream.on('data', (data: pb.kubemq.Request) => {
          console.debug(`Queries Message received: ID='${data.RequestID}', Channel='${data.Channel}'`);
          const event = QueryMessageReceived.decode(data);
          request.raiseOnReceiveMessage(event); // Process received event
      });

      // Handle errors (like server being unavailable)
      stream.on('error', (err: grpc.ServiceError) => {
          console.error('Queries Subscription error:', err.message);
          console.error('Queries Subscription error code:', err.code);

          request.raiseOnError(err.message);

          if (err.code === grpc.status.UNAVAILABLE) {
              console.debug('Server is unavailable, attempting to reconnect...');
              request.reconnect(this, this.reconnectIntervalSeconds); // Trigger reconnection
          }
      });

      // Handle stream close
      stream.on('close', () => {
          console.debug('Stream closed by the server, attempting to reconnect...');
          request.reconnect(this, this.reconnectIntervalSeconds); // Attempt to reconnect when the stream is closed
      });
  } catch (error) {
      console.error('Failed to subscribe to events', error);
      throw new Error('Subscription failed');
  }
}
}

 

//   private subscribeFnQueries(request: QueriesSubscriptionRequest, cb: QueriesReceiveMessageCallback): Promise<internalQueriesSubscriptionResponse> {
//     return new Promise<internalQueriesSubscriptionResponse>((resolve, reject) => {
//       if (!cb) {
//         reject(new Error('queries subscription requires a callback'));
//         return;
//       }

//       const pbSubRequest = new pb.kubemq.Subscribe();
//       pbSubRequest.ClientID=(request.clientId ? request.clientId : this.clientId);
//       pbSubRequest.Group=(request.group ? request.group : '');
//       pbSubRequest.Channel=(request.channel);
//       pbSubRequest.SubscribeTypeData= pb.kubemq.Subscribe.SubscribeType.Queries;

//       const stream = this.grpcClient.SubscribeToRequests(pbSubRequest, this.getMetadata());

//       stream.on('data', function (data: pb.kubemq.Request) {
//         cb(null, {
//           id: data.RequestID,
//           channel: data.Channel,
//           metadata: data.Metadata,
//           body: data.Body,
//           tags: data.Tags,
//           replyChannel: data.ReplyChannel,
//         });
//       });

//       stream.on('error', (e: Error) => {
//         cb(e, null);
//       });

//       let onClose = new TypedEvent<void>();
//       stream.on('close', () => {
//         onClose.emit();
//       });

//       resolve({
//         onClose: onClose,
//         stream: stream,
//       });
//     });
//   }

// }