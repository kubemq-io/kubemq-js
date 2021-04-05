import { BaseMessage, Client, StreamState } from './client';
import { Config } from './config';
import * as pb from '../src/protos';
import { Utils } from './utils';
import { TypedEvent } from './common';
import * as grpc from '@grpc/grpc-js';

export interface EventsMessage extends BaseMessage {}
export interface EventsReceiveMessage {
  id: string;
  channel: string;
  metadata: string;
  body: Uint8Array | string;
  tags: Map<string, string>;
}

export interface EventReceiveCallback {
  (err: Error | null, msg: EventsReceiveMessage): void;
}

export interface EventsSendResult {
  id: string;
  sent: boolean;
}

export interface EventsSubscriptionRequest {
  channel: string;
  group?: string;
  clientId?: string;
}

export interface EventsSubscriptionResponse {
  onStatus: TypedEvent<grpc.status>;
  unsubscribe(): void;
}

export interface EventsStreamResponse {
  state: StreamState;
  onResult: TypedEvent<EventsSendResult>;
  onError: TypedEvent<Error>;
  onStateChanged: TypedEvent<StreamState>;
  write(message: EventsMessage): Promise<void>;
  end(): void;
  cancel(): void;
}

export class EventsClient extends Client {
  constructor(Options: Config) {
    super(Options);
  }

  public send(message: EventsMessage): Promise<EventsSendResult> {
    const pbMessage = new pb.Event();
    pbMessage.setEventid(message.id ? message.id : Utils.uuid());
    pbMessage.setClientid(
      message.clientId ? message.clientId : this.clientOptions.clientId,
    );
    pbMessage.setChannel(message.channel);
    pbMessage.setBody(message.body);
    pbMessage.setMetadata(message.metadata);
    if (message.tags != null) {
      pbMessage.getTagsMap().set(message.tags);
    }
    pbMessage.setStore(false);
    return new Promise<EventsSendResult>((resolve, reject) => {
      this.grpcClient.sendEvent(
        pbMessage,
        this.getMetadata(),
        this.callOptions(),
        (e) => {
          if (e) {
            reject(e);
            return;
          }
          resolve({ id: pbMessage.getEventid(), sent: true });
        },
      );
    });
  }

  public stream(): Promise<EventsStreamResponse> {
    return new Promise<EventsStreamResponse>((resolve, reject) => {
      try {
        const stream = this.grpcClient.sendEventsStream(this.getMetadata());
        let state: StreamState = StreamState.Initialized;
        const onStateChanged: TypedEvent<StreamState> = new TypedEvent<StreamState>();
        const onError: TypedEvent<Error> = new TypedEvent<Error>();
        const onResult: TypedEvent<EventsSendResult> = new TypedEvent<EventsSendResult>();

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
        const clientIdFromOptions = this.clientOptions.clientId;
        const writeFn = function (message: EventsMessage): Promise<void> {
          return new Promise<void>((resolve, reject) => {
            try {
              const pbMessage = new pb.Event();
              pbMessage.setEventid(message.id ? message.id : Utils.uuid());
              pbMessage.setClientid(
                message.clientId ? message.clientId : clientIdFromOptions,
              );
              pbMessage.setChannel(message.channel);
              pbMessage.setBody(message.body);
              pbMessage.setMetadata(message.metadata);
              if (message.tags != null) {
                pbMessage.getTagsMap().set(message.tags);
              }
              pbMessage.setStore(false);
              stream.write(pbMessage);
              if (state !== StreamState.Connected) {
                state = StreamState.Connected;
                onStateChanged.emit(StreamState.Connected);
              }
              onResult.emit({
                id: pbMessage.getEventid(),
                sent: true,
              });
              resolve();
            } catch (e) {
              reject(e);
            }
          });
        };
        resolve({
          onResult,
          onError: onError,
          onStateChanged: onStateChanged,
          state: state,
          write: writeFn,
          cancel() {
            stream.cancel();
          },
          end(): void {
            stream.end();
          },
        });
      } catch (e) {
        reject(e);
      }
    });
  }
  public subscribe(
    request: EventsSubscriptionRequest,
    cb: EventReceiveCallback,
  ): Promise<EventsSubscriptionResponse> {
    return new Promise<EventsSubscriptionResponse>((resolve, reject) => {
      if (!cb) {
        reject(new Error('subscribe requires a callback'));
      }
      const pbSubRequest = new pb.Subscribe();
      pbSubRequest.setClientid(
        request.clientId ? request.clientId : this.clientOptions.clientId,
      );
      pbSubRequest.setGroup(request.group ? request.group : '');
      pbSubRequest.setChannel(request.channel);
      pbSubRequest.setSubscribetypedata(1);

      const stream = this.grpcClient.subscribeToEvents(
        pbSubRequest,
        this.getMetadata(),
      );
      let onStateChanged = new TypedEvent<grpc.status>();
      stream.on('data', (data: pb.EventReceive) => {
        cb(null, {
          id: data.getEventid(),
          channel: data.getChannel(),
          metadata: data.getMetadata(),
          body: data.getBody(),
          tags: data.getTagsMap(),
        });
      });
      stream.on('error', (e: Error) => {
        cb(e, null);
      });
      stream.on('status', (status: grpc.status) => {
        onStateChanged.emit(status);
      });
      resolve({
        onStatus: onStateChanged,
        unsubscribe() {
          stream.cancel();
        },
      });
    });
  }
}

export class EventsSubscriber {
  public state = StreamState.Initialized;
  public onStateChanged = new TypedEvent<StreamState>();
  public onEvent = new TypedEvent<EventsReceiveMessage>();
  public onError = new TypedEvent<Error>();
  private stream: grpc.ClientReadableStream<pb.EventReceive>;
  private isDone = false;
  constructor(
    private eventsClient: EventsClient,
    private request: EventsSubscriptionRequest,
  ) {}

  private emitError(err: Error): void {
    if (this.isDone) {
      return;
    }
    this.onError.emit(err);
    if (this.state !== StreamState.Error) {
      this.state = StreamState.Error;
      this.onStateChanged.emit(StreamState.Error);
    }
  }
  private emitClose(): void {
    if (this.isDone) {
      return;
    } else {
      this.state = StreamState.Closed;
      this.onStateChanged.emit(StreamState.Closed);
      this.state = StreamState.ReConnect;
      this.onStateChanged.emit(StreamState.ReConnect);
      this.reconnect();
    }
  }

  private reconnect(): void {
    const isConnected = false;
    while (!isConnected) {
      setTimeout(() => {
        console.log('reconnect');
      }, 2000);
    }
  }

  public done(): void {
    this.isDone = true;
    this.stream.cancel();
    this.state = StreamState.Done;
    this.onStateChanged.emit(StreamState.Done);
    this.stream = null;
  }

  public connect(): Promise<EventsSubscriber> {
    return new Promise<EventsSubscriber>(async (resolve, reject) => {
      await this.eventsClient.ping().catch((reason) => {
        reject(reason);
      });
      const pbSubRequest = new pb.Subscribe();
      pbSubRequest.setClientid(
        this.request.clientId
          ? this.request.clientId
          : this.eventsClient.getClientOption().clientId,
      );
      pbSubRequest.setGroup(this.request.group ? this.request.group : '');
      pbSubRequest.setChannel(this.request.channel);
      pbSubRequest.setSubscribetypedata(1);
      this.stream = this.eventsClient
        .getGrpcClient()
        .subscribeToEvents(pbSubRequest, this.eventsClient.getMetadata());
      this.stream.on('data', (data: pb.EventReceive) => {
        this.onEvent.emit({
          id: data.getEventid(),
          channel: data.getChannel(),
          metadata: data.getMetadata(),
          body: data.getBody(),
          tags: data.getTagsMap(),
        });
        if (this.state !== StreamState.Connected) {
          this.state = StreamState.Connected;
          this.onStateChanged.emit(StreamState.Connected);
        }
      });
      this.stream.on('error', (e: Error) => {
        this.emitError(e);
      });
      this.stream.on('close', () => {
        this.emitClose();
      });
      this.state = StreamState.Connected;
      resolve(this);
    });
  }
}
