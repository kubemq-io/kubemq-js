import { BaseMessage, Client, TypedEvent } from './client';
import { Config } from './config';
import * as pb from './protos';
import { Utils } from './utils';
import * as grpc from '@grpc/grpc-js';

/**
 * command request base message
 */
export interface CommandsMessage extends BaseMessage {
  /** command request timeout in milliseconds */
  timeout?: number;
}

/**
 * command request received by commands subscriber
 */
export interface CommandsReceiveMessage {
  /** send command request id */
  id: string;

  /** channel name */
  channel: string;

  /** command request metadata */
  metadata: string;

  /** command request payload */
  body: Uint8Array | string;

  /** command request key/value tags */
  tags: Map<string, string>;

  /** command request replay channel for response */
  replyChannel: string;
}

/**
 * command response
 */
export interface CommandsResponse {
  /** send command request id */
  id: string;

  /** command response replay channel*/
  replyChannel?: string;

  /** clientId name of the responder*/
  clientId: string;

  /** response timestamp in Unix Epoch time*/
  timestamp: number;

  /** indicates execution of the command request*/
  executed: boolean;

  /** execution error if present*/
  error: string;
}

/** command requests subscription callback */
export interface CommandsReceiveMessageCallback {
  (err: Error | null, msg: CommandsReceiveMessage): void;
}

/** commands requests subscription */
export interface CommandsSubscriptionRequest {
  /** command requests channel */
  channel: string;

  /** command requests channel group*/
  group?: string;

  /** command requests clientId */
  clientId?: string;
}

/** commands requests subscription response*/
export interface internalCommandsSubscriptionResponse {
  /** emit events on close subscription*/
  onClose: TypedEvent<void>;

  /** call stream*/
  stream: grpc.ClientReadableStream<pb.Request>;
}
/** commands requests subscription response*/
export interface CommandsSubscriptionResponse {
  onState: TypedEvent<string>;
  /** call unsubscribe*/
  unsubscribe(): void;
}
/**
 * Commands Client - KubeMQ commands client
 */
export class CommandsClient extends Client {
  /**
   * @internal
   */
  constructor(Options: Config) {
    super(Options);
  }

  /**
   * Send command request to server and waits for response
   * @param msg
   * @return Promise<CommandsResponse>
   */
  send(msg: CommandsMessage): Promise<CommandsResponse> {
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
  /**
   * Send response for a command request to the server
   * @param msg
   * @return Promise<void>
   */
  response(msg: CommandsResponse): Promise<void> {
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
  /**
   * Subscribe to commands requests
   * @param request
   * @param cb
   * @return Promise<CommandsSubscriptionResponse>
   */

  async Subscribe(
    request: CommandsSubscriptionRequest,
    cb: CommandsReceiveMessageCallback,
  ): Promise<CommandsSubscriptionResponse> {
    return new Promise<CommandsSubscriptionResponse>(
      async (resolve, reject) => {
        if (!request) {
          reject(new Error('queries subscription requires a request object'));
          return;
        }
        if (request.channel === '') {
          reject(
            new Error(
              'commands subscription requires a non empty request channel',
            ),
          );
          return;
        }
        if (!cb) {
          reject(new Error('commands subscription requires a callback'));
          return;
        }
        let unsubscribe = false;
        const onStateChange = new TypedEvent<string>();
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
            value.onClose.on(() => {
              isClosed = true;
              onStateChange.emit('disconnected');
            });
            currentStream = value.stream;
          });
          let isClosed = false;
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
      },
    );
  }

  private subscribeFn(
    request: CommandsSubscriptionRequest,
    cb: CommandsReceiveMessageCallback,
  ): Promise<internalCommandsSubscriptionResponse> {
    return new Promise<internalCommandsSubscriptionResponse>(
      (resolve, reject) => {
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
          stream: stream,
        });
      },
    );
  }
}
