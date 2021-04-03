import { BaseMessage, Client } from './client';
import { Config } from './config';
import * as pb from '../src/protos';
import { Utils } from './utils';

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
  onEventFn?: (event: EventsStoreReceiveMessage) => void;
  onErrorFn?: (e: Error) => void;
  onCloseFn?: () => void;
}

export interface EventsStoreSubscriptionResponse {
  cancel(): void;
}

export interface EventsStoreStreamRequest {
  onResultFn?: (result: EventsStoreSendResult) => void;
  onErrorFn?: (e: Error) => void;
  onCloseFn?: () => void;
}

export interface EventsStoreStreamResponse {
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
  public stream(request: EventsStoreStreamRequest): EventsStoreStreamResponse {
    const stream = this.grpcClient.sendEventsStream(
      this.metadata(),
      this.callOptions(),
    );
    stream.on('data', function (result: pb.Result) {
      if (request.onResultFn != null) {
        request.onResultFn({
          id: result.getEventid(),
          sent: result.getSent(),
          error: result.getError(),
        });
      }
    });

    stream.on('error', function (e: Error) {
      if (request.onErrorFn != null) {
        request.onErrorFn(e);
      }
    });

    stream.on('close', function () {
      if (request.onCloseFn != null) {
        request.onCloseFn();
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
    return { write: writeFn, cancel: stream.cancel, end: stream.end };
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
      this.callOptions(),
    );
    stream.on('data', function (data: pb.EventReceive) {
      if (request.onEventFn != null) {
        request.onEventFn({
          id: data.getEventid(),
          channel: data.getChannel(),
          metadata: data.getMetadata(),
          body: data.getBody(),
          tags: data.getTagsMap(),
          timestamp: data.getTimestamp(),
          sequence: data.getSequence(),
        });
      }
    });

    stream.on('error', function (e: Error) {
      if (request.onErrorFn != null) {
        request.onErrorFn(e);
      }
    });

    stream.on('close', function () {
      if (request.onCloseFn != null) {
        request.onCloseFn();
      }
    });
    return { cancel: stream.cancel };
  }
}
