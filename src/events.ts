import { BaseMessage, Client, StreamState } from './client';
import { Config } from './config';
import * as pb from '../src/protos';
import { Utils } from './utils';
import { TypedEvent } from './common';

export interface EventsMessage extends BaseMessage {}
export interface EventsReceiveMessage {
  id: string;
  channel: string;
  metadata: string;
  body: Uint8Array | string;
  tags: Map<string, string>;
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
  state: StreamState;
  onEvent: TypedEvent<EventsReceiveMessage>;
  onError: TypedEvent<Error>;
  onStateChanged: TypedEvent<StreamState>;
  cancel(): void;
}

export interface EventsStreamResponse {
  state: StreamState;
  onResult: TypedEvent<EventsSendResult>;
  onError: TypedEvent<Error>;
  onStateChanged: TypedEvent<StreamState>;
  write(message: EventsMessage): void;
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
        this.metadata(),
        this.callOptions(),
        (e) => {
          if (e) reject(e);
          resolve({ id: pbMessage.getEventid(), sent: true });
        },
      );
    });
  }
  public stream(): EventsStreamResponse {
    const stream = this.grpcClient.sendEventsStream(this.metadata());
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
    const writeFn = function (message: EventsMessage): void {
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
      if (state !== StreamState.Ready) {
        state = StreamState.Ready;
        onStateChanged.emit(StreamState.Ready);
      }
      onResult.emit({
        id: pbMessage.getEventid(),
        sent: true,
      });
    };
    return {
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
    };
  }
  public subscribe(
    request: EventsSubscriptionRequest,
  ): EventsSubscriptionResponse {
    const pbSubRequest = new pb.Subscribe();
    pbSubRequest.setClientid(
      request.clientId ? request.clientId : this.clientOptions.clientId,
    );
    pbSubRequest.setGroup(request.group ? request.group : '');
    pbSubRequest.setChannel(request.channel);
    pbSubRequest.setSubscribetypedata(1);
    const stream = this.grpcClient.subscribeToEvents(
      pbSubRequest,
      this.metadata(),
    );
    let state = StreamState.Initialized;
    let onStateChanged = new TypedEvent<StreamState>();
    let onEvent = new TypedEvent<EventsReceiveMessage>();
    let onError = new TypedEvent<Error>();

    stream.on('data', function (data: pb.EventReceive) {
      onEvent.emit({
        id: data.getEventid(),
        channel: data.getChannel(),
        metadata: data.getMetadata(),
        body: data.getBody(),
        tags: data.getTagsMap(),
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
    return {
      state: state,
      onEvent: onEvent,
      onStateChanged: onStateChanged,
      onError: onError,
      cancel() {
        stream.cancel();
      },
    };
  }
}
