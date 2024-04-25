import { BaseMessage, Client, TypedEvent } from './client';
import { Config } from './config';
import * as pb from './protos';
import { Utils } from './utils';
import * as grpc from '@grpc/grpc-js';
import { createChannel } from './common';

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
interface internalEventsSubscriptionResponse {
  /** emit events on close subscription*/
  onClose: TypedEvent<void>;

  /** call stream*/
  stream: grpc.ClientReadableStream<pb.EventReceive>;
}

/** events store requests subscription response*/
export interface EventsSubscriptionResponse {
  onState: TypedEvent<string>;
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
  async subscribe(
    request: EventsSubscriptionRequest,
    cb: EventsReceiveMessageCallback,
  ): Promise<EventsSubscriptionResponse> {
    return new Promise<EventsSubscriptionResponse>(async (resolve, reject) => {
      if (!request) {
        reject(new Error('events subscription requires a request object'));
        return;
      }
      if (request.channel === '') {
        reject(
          new Error('events subscription requires a non empty request channel'),
        );
        return;
      }
      if (!cb) {
        reject(new Error('events subscription requires a callback'));
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
        const reconnectionInterval = this.clientOptions.reconnectInterval;
        if (reconnectionInterval === 0) {
          unsubscribe = true;
        } else {
          await new Promise((r) => setTimeout(r, reconnectionInterval));
        }
      }
      currentStream.cancel();
    });
  }

  private subscribeFn(
    request: EventsSubscriptionRequest,
    cb: EventsReceiveMessageCallback,
  ): Promise<internalEventsSubscriptionResponse> {
    return new Promise<internalEventsSubscriptionResponse>(
      (resolve, reject) => {
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
  /**
   * Create channel
   * @param channelName
   * @return Promise<void>
   */
  create(channelName: string): Promise<void> {
    return createChannel(
      this.grpcClient,
      this.getMetadata(),
      this.clientOptions.clientId,
      channelName,
      'events',
    );
  }
}
