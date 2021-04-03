import { BaseMessage, Client, StreamState } from './client';
import { Config } from './config';
import * as pb from '../src/protos';
import { Utils } from './utils';
import { TypedEvent } from './common';

export enum EventStoreType {
  StartNewOnly = 1,
  StartFromFirst,
  StartFromLast,
  StartAtSequence,
  StartAtTime,
  StartAtTimeDelta,
}
export interface EventsStoreMessage extends BaseMessage {}
export interface EventsStoreReceiveMessage {
  id: string;
  channel: string;
  metadata: string;
  body: Uint8Array | string;
  tags: Map<string, string>;
  timestamp: number;
  sequence: number;
}
export interface EventsStoreSendResult {
  id: string;
  sent: boolean;
  error: string;
}

export interface EventsStoreSubscriptionRequest {
  channel: string;
  group?: string;
  clientId?: string;
  requestType: EventStoreType;
  requestTypeValue?: number;
}

export interface EventsStoreSubscriptionResponse {
  state: StreamState;
  onEvent: TypedEvent<EventsStoreReceiveMessage>;
  onError: TypedEvent<Error>;
  onStateChanged: TypedEvent<StreamState>;
  cancel(): void;
}

export interface EventsStoreStreamResponse {
  state: StreamState;
  onResult: TypedEvent<EventsStoreSendResult>;
  onError: TypedEvent<Error>;
  onStateChanged: TypedEvent<StreamState>;
  write(message: EventsStoreMessage): void;
  end(): void;
  cancel(): void;
}

export class EventsStoreClient extends Client {
  constructor(Options: Config) {
    super(Options);
  }

  public send(message: EventsStoreMessage): Promise<EventsStoreSendResult> {
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
    pbMessage.setStore(true);
    return new Promise<EventsStoreSendResult>((resolve, reject) => {
      this.grpcClient.sendEvent(
        pbMessage,
        this.metadata(),
        this.callOptions(),
        (e, result) => {
          if (e) reject(e);
          if (result != null)
            resolve({
              id: result.getEventid(),
              sent: result.getSent(),
              error: result.getError(),
            });
        },
      );
    });
  }
  public stream(): EventsStoreStreamResponse {
    const stream = this.grpcClient.sendEventsStream(this.metadata());
    let state: StreamState = StreamState.Initialized;
    const onStateChanged: TypedEvent<StreamState> = new TypedEvent<StreamState>();
    const onError: TypedEvent<Error> = new TypedEvent<Error>();
    const onResult: TypedEvent<EventsStoreSendResult> = new TypedEvent<EventsStoreSendResult>();
    stream.on('data', function (result: pb.Result) {
      onResult.emit({
        id: result.getEventid(),
        sent: result.getSent(),
        error: result.getError(),
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

    const clientIdFromOptions = this.clientOptions.clientId;
    const writeFn = function (message: EventsStoreMessage): void {
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
      pbMessage.setStore(true);
      stream.write(pbMessage);
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
    request: EventsStoreSubscriptionRequest,
  ): EventsStoreSubscriptionResponse {
    const pbSubRequest = new pb.Subscribe();
    pbSubRequest.setClientid(
      request.clientId ? request.clientId : this.clientOptions.clientId,
    );
    pbSubRequest.setGroup(request.group ? request.group : '');
    pbSubRequest.setChannel(request.channel);
    pbSubRequest.setSubscribetypedata(2);
    pbSubRequest.setEventsstoretypedata(
      request.requestType ? request.requestType : 1,
    );
    pbSubRequest.setEventsstoretypevalue(
      request.requestTypeValue ? request.requestTypeValue : 0,
    );
    const stream = this.grpcClient.subscribeToEvents(
      pbSubRequest,
      this.metadata(),
    );

    let state = StreamState.Initialized;
    let onStateChanged = new TypedEvent<StreamState>();
    let onEvent = new TypedEvent<EventsStoreReceiveMessage>();
    let onError = new TypedEvent<Error>();
    stream.on('data', function (data: pb.EventReceive) {
      onEvent.emit({
        id: data.getEventid(),
        channel: data.getChannel(),
        metadata: data.getMetadata(),
        body: data.getBody(),
        tags: data.getTagsMap(),
        timestamp: data.getTimestamp(),
        sequence: data.getSequence(),
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
