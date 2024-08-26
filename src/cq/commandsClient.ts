// commandsClient.ts

import { TypedEvent,KubeMQClient } from '../client/KubeMQClient';
import { Config } from '../client/config';
import * as pb from '../protos';
import { Utils } from '../common/utils';
import * as grpc from '@grpc/grpc-js';
import { createChannel, deleteChannel, listCQChannels } from '../common/common';
import { CQChannel } from '../common/channel_stats';
import {
  CommandsMessage,
  CommandsResponse,
  CommandsReceiveMessageCallback,
  CommandsSubscriptionRequest,
  CommandsSubscriptionResponse,
} from './commandTypes';

interface InternalCommandsSubscriptionResponse {
    onClose: TypedEvent<void>;
    stream: grpc.ClientReadableStream<pb.Request>;
  }

export class CommandsClient extends KubeMQClient {
  constructor(Options: Config) {
    super(Options);
  }

  send(msg: CommandsMessage): Promise<CommandsResponse> {
    const pbMessage = new pb.Request();
    pbMessage.setRequestid(msg.id ? msg.id : Utils.uuid());
    pbMessage.setClientid(msg.clientId ? msg.clientId : this.clientId);

    if (!msg.channel || msg.channel.trim().length === 0) {
      throw new Error('Command message must have a channel.');
    }
    pbMessage.setChannel(msg.channel);
    pbMessage.setReplychannel(msg.channel);

    if (
      (!msg.metadata || msg.metadata.trim().length === 0) &&
      (!msg.body || msg.body.length === 0) &&
      (!msg.tags || msg.tags.size === 0)
    ) {
      throw new Error('Command message must have at least one of the following: metadata, body, or tags.');
    }

    pbMessage.setBody(msg.body);
    pbMessage.setMetadata(msg.metadata);
    if (msg.tags != null) {
      pbMessage.getTagsMap().set(msg.tags);
    }

    if (msg.timeout <= 0) {
      throw new Error('Command message timeout must be a positive integer.');
    }
    pbMessage.setTimeout(msg.timeout);

    pbMessage.setRequesttypedata(1);

    return new Promise<CommandsResponse>((resolve, reject) => {
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
          });
        },
      );
    });
  }

  response(msg: CommandsResponse): Promise<void> {
    const pbMessage = new pb.Response();
    pbMessage.setRequestid(msg.id);
    pbMessage.setClientid(msg.clientId ? msg.clientId : this.clientId);
    pbMessage.setReplychannel(msg.replyChannel);
    pbMessage.setError(msg.error);
    pbMessage.setExecuted(msg.executed);
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

  async subscribe(
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
      },
    );
  }

  private subscribeFn(
    request: CommandsSubscriptionRequest,
    cb: CommandsReceiveMessageCallback,
  ): Promise<InternalCommandsSubscriptionResponse> {
    return new Promise<InternalCommandsSubscriptionResponse>(
      (resolve, reject) => {
        if (!cb) {
          reject(new Error('commands subscription requires a callback'));
          return;
        }

        const pbSubRequest = new pb.Subscribe();
        pbSubRequest.setClientid(request.clientId ? request.clientId : this.clientId);
        pbSubRequest.setGroup(request.group ? request.group : '');
        pbSubRequest.setChannel(request.channel);
        pbSubRequest.setSubscribetypedata(3);
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
      },
    );
  }

  create(channelName: string): Promise<void> {
    return createChannel(
      this.grpcClient,
      this.getMetadata(),
      this.clientId,
      channelName,
      'commands',
    );
  }

  delete(channelName: string): Promise<void> {
    return deleteChannel(
      this.grpcClient,
      this.getMetadata(),
      this.clientId,
      channelName,
      'commands',
    );
  }

  list(search: string): Promise<CQChannel[]> {
    return listCQChannels(
      this.grpcClient,
      this.getMetadata(),
      this.clientId,
      search,
      'commands',
    );
  }
}
