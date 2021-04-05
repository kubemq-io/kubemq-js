import { BaseMessage, Client } from './client';
import { Config } from './config';
import * as pb from '../src/protos';
import { Utils } from './utils';
import { TypedEvent } from './common';

export interface CommandsMessage extends BaseMessage {
  timeout?: number;
}
export interface CommandsReceiveMessage {
  id: string;
  channel: string;
  metadata: string;
  body: Uint8Array | string;
  tags: Map<string, string>;
  replyChannel: string;
}

export interface CommandsResponse {
  id: string;
  replyChannel?: string;
  clientId: string;
  timestamp: number;
  executed: boolean;
  error: string;
}

export interface CommandsReceiveMessageCallback {
  (err: Error | null, msg: CommandsReceiveMessage): void;
}
export interface CommandsSubscriptionRequest {
  channel: string;
  group?: string;
  clientId?: string;
}

export interface CommandsSubscriptionResponse {
  onClose: TypedEvent<void>;
  unsubscribe(): void;
}

export class CommandsClient extends Client {
  constructor(Options: Config) {
    super(Options);
  }

  public send(msg: CommandsMessage): Promise<CommandsResponse> {
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

  public response(msg: CommandsResponse): Promise<void> {
    const pbMessage = new pb.Response();
    pbMessage.setRequestid(msg.id);
    pbMessage.setClientid(
      msg.clientId ? msg.clientId : this.clientOptions.clientId,
    );
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

  public subscribe(
    request: CommandsSubscriptionRequest,
    cb: CommandsReceiveMessageCallback,
  ): Promise<CommandsSubscriptionResponse> {
    return new Promise<CommandsSubscriptionResponse>((resolve, reject) => {
      if (!cb) {
        reject(new Error('commands subscription requires a callback'));
        return;
      }

      const pbSubRequest = new pb.Subscribe();
      pbSubRequest.setClientid(
        request.clientId ? request.clientId : this.clientOptions.clientId,
      );
      pbSubRequest.setGroup(request.group ? request.group : '');
      pbSubRequest.setChannel(request.channel);
      pbSubRequest.setSubscribetypedata(3);

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
