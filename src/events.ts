import { BaseMessage, Client, TypedEvent } from './client';
import { Config } from './config';
import * as pb from '../src/protos';
import { Utils } from './utils';
/**
 * events base message
 */
export interface EventsMessage extends BaseMessage {}

/**
 * events received by events subscriber
 */
export interface EventsReceiveMessage {
  /** send event request id */
  id: string;

  /** channel name */
  channel: string;

  /** event metadata */
  metadata: string;

  /** event payload */
  body: Uint8Array | string;

  /** event key/value tags */
  tags: Map<string, string>;
}
/** events subscription callback */
export interface EventsReceiveMessageCallback {
  (err: Error | null, msg: EventsReceiveMessage): void;
}
/** events stream callback */
export interface EventsStreamCallback {
  (err: Error | null, result: EventsSendResult): void;
}
/** events sending result */
export interface EventsSendResult {
  id: string;
  sent: boolean;
}
/** events requests subscription */
export interface EventsSubscriptionRequest {
  /** event subscription channel */
  channel: string;

  /** event subscription channel group*/
  group?: string;

  /** event subscription clientId */
  clientId?: string;
}

/** events subscription response*/
export interface EventsSubscriptionResponse {
  /** emit events on close subscription*/
  onClose: TypedEvent<void>;

  /** call unsubscribe*/
  unsubscribe(): void;
}
/** events requests subscription response*/
export interface EventsStreamResponse {
  /** emit events on close stream*/
  onClose: TypedEvent<void>;

  /** write events to stream*/
  write(msg: EventsMessage): void;

  /** end events stream*/
  end(): void;
}

/**
 * Events Client - KubeMQ events client
 */
export class EventsClient extends Client {
  /**
   * @internal
   */
  constructor(Options: Config) {
    super(Options);
  }
  /**
   * Send single event
   * @param msg
   * @return Promise<EventsSendResult>
   */
  send(msg: EventsMessage): Promise<EventsSendResult> {
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
  /**
   * Send stream of events
   * @return Promise<EventsStreamResponse>
   * @param cb
   */
  public stream(cb: EventsStreamCallback): Promise<EventsStreamResponse> {
    return new Promise<EventsStreamResponse>((resolve, reject) => {
      if (!cb) {
        reject(new Error('stream events call requires a callback'));
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

      const writeFn = (msg: EventsMessage) => {
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
  /**
   * Subscribe to events messages
   * @param request
   * @param cb
   * @return Promise<EventsSubscriptionResponse>
   */
  subscribe(
    request: EventsSubscriptionRequest,
    cb: EventsReceiveMessageCallback,
  ): Promise<EventsSubscriptionResponse> {
    return new Promise<EventsSubscriptionResponse>((resolve, reject) => {
      if (!cb) {
        reject(new Error('events subscription requires a callback'));
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
