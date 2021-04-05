import { BaseMessage, Client } from './client';
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
export interface EventsReceiveMessageCallback {
  (err: Error | null, msg: EventsReceiveMessage): void;
}

export interface EventsStreamCallback {
  (err: Error | null, result: EventsSendResult): void;
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
  onClose: TypedEvent<void>;
  unsubscribe(): void;
}

export interface EventsStreamResponse {
  onClose: TypedEvent<void>;
  write(msg: EventsMessage): void;
  end(): void;
}

export class EventsClient extends Client {
  constructor(Options: Config) {
    super(Options);
  }
  public send(msg: EventsMessage): Promise<EventsSendResult> {
    const pbMessage = new pb.Event();
    pbMessage.setEventid(msg.id ? msg.id : Utils.uuid());
    pbMessage.setClientid(
      msg.clientId ? msg.clientId : this.clientOptions.clientId,
    );
    pbMessage.setChannel(msg.channel);
    pbMessage.setBody(msg.body);
    pbMessage.setMetadata(msg.metadata);
    if (msg.tags != null) {
      pbMessage.getTagsMap().set(msg.tags);
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

  public stream(cb: EventsStreamCallback): Promise<EventsStreamResponse> {
    return new Promise<EventsStreamResponse>((resolve, reject) => {
      if (!cb) {
        reject(new Error('stream call requires a callback'));
        return;
      }
      const stream = this.grpcClient.sendEventsStream(this.getMetadata());
      stream.on('error', (e: Error) => {
        cb(e, null);
      });
      let onCloseEvent = new TypedEvent<void>();
      stream.on('close', () => {
        onCloseEvent.emit();
      });

      const writeFn = function (msg: EventsMessage) {
        const pbMessage = new pb.Event();
        pbMessage.setEventid(msg.id ? msg.id : Utils.uuid());
        pbMessage.setClientid(
          msg.clientId ? msg.clientId : this.clientOptions.clientId,
        );
        pbMessage.setChannel(msg.channel);
        pbMessage.setBody(msg.body);
        pbMessage.setMetadata(msg.metadata);
        if (msg.tags != null) {
          pbMessage.getTagsMap().set(msg.tags);
        }
        pbMessage.setStore(false);
        const sent = stream.write(pbMessage, (err: Error) => {
          cb(err, null);
        });
        cb(null, {
          id: pbMessage.getEventid(),
          sent: sent,
        });
      };
      resolve({
        onClose: onCloseEvent,
        write: writeFn,
        end(): void {
          stream.end();
        },
      });
    });
  }

  public subscribe(
    request: EventsSubscriptionRequest,
    cb: EventsReceiveMessageCallback,
  ): Promise<EventsSubscriptionResponse> {
    return new Promise<EventsSubscriptionResponse>((resolve, reject) => {
      if (!cb) {
        reject(new Error('subscribe requires a callback'));
        return;
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
      let onCloseEvent = new TypedEvent<void>();
      stream.on('close', () => {
        onCloseEvent.emit();
      });
      resolve({
        onClose: onCloseEvent,
        unsubscribe() {
          stream.cancel();
        },
      });
    });
  }
}
