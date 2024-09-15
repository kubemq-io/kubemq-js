// types.ts
import { BaseMessage,TypedEvent } from '../client/KubeMQClient';
import * as pb from '../protos';
import * as grpc from '@grpc/grpc-js';
import { CQClient } from './CQClient';

export interface CommandsMessage extends BaseMessage {
  timeout?: number;
}

export class CommandMessageReceived {
  /**
   * Unique identifier for the received command message.
   */
  id: string;

  /**
   * The client ID from which the command message was sent.
   */
  fromClientId: string;

  /**
   * The timestamp when the command message was received.
   */
  timestamp: Date;

  /**
   * The channel from which the command message was received.
   */
  channel: string;

  /**
   * Metadata associated with the received command message.
   */
  metadata: string;

  /**
   * Body of the received command message in bytes.
   */
  body: Uint8Array | string;

  /**
   * Reply channel associated with the received command message.
   */
  replyChannel: string;

  /**
   * Tags associated with the received command message as key-value pairs.
   */
  tags: Map<string, string>;

  /**
   * Constructor to initialize the fields.
   */
  constructor() {
    this.id = '';
    this.fromClientId = '';
    this.timestamp = new Date();
    this.channel = '';
    this.metadata = '';
    this.body = new Uint8Array();
    this.replyChannel = '';
    this.tags = new Map<string, string>();
  }

  /**
   * Decodes a protocol buffer request into a CommandMessageReceived instance.
   *
   * @param commandReceive The protocol buffer request to decode.
   * @return The decoded CommandMessageReceived instance.
   */
  public static decode(commandReceive: pb.kubemq.Request): CommandMessageReceived {
    const message = new CommandMessageReceived();
    message.id = commandReceive.RequestID;
    message.fromClientId = commandReceive.ClientID;
    message.channel = commandReceive.Channel;
    message.metadata = commandReceive.Metadata;
    message.body = typeof commandReceive.Body === 'string'
      ? new TextEncoder().encode(commandReceive.Body)
      : commandReceive.Body;
    message.replyChannel = commandReceive.ReplyChannel;
    message.tags = commandReceive.Tags;

    return message;
  }
}


export class CommandsSubscriptionRequest {
  channel: string;
  group?: string;

  onReceiveEventCallback?: (event: CommandMessageReceived) => void;
  onErrorCallback?: (error: string) => void;

  observer?: grpc.ClientReadableStream<pb.kubemq.Request>;
  isReconnecting: boolean = false;  // Flag to track reconnection status

  constructor(channel: string, group?: string) {
      this.channel = channel;
      this.group = group;
  }

  validate() {
      if (!this.channel || !this.onReceiveEventCallback) {
          throw new Error('Event subscription must have a channel and onReceiveEventCallback.');
      }
  }

  encode(cqClient: CQClient): pb.kubemq.Subscribe {
      const subscribe = new pb.kubemq.Subscribe();
      subscribe.ClientID = cqClient.clientId;
      subscribe.Channel = this.channel;
      subscribe.Group = this.group || '';
      subscribe.SubscribeTypeData = pb.kubemq.Subscribe.SubscribeType.Commands;

      return subscribe;
  }

  raiseOnReceiveMessage(event: CommandMessageReceived) {
      if (this.onReceiveEventCallback) {
          this.onReceiveEventCallback(event);
      }
  }

  raiseOnError(errorMsg: string) {
      if (this.onErrorCallback) {
          this.onErrorCallback(errorMsg);
      }
  }

  cancel() {
      if (this.observer) {
          this.observer.cancel();
          console.debug('Subscription cancelled');
      }
  }

  reconnect(cqClient: CQClient, reconnectIntervalSeconds: number) {
      if (this.isReconnecting) {
          console.debug('Already reconnecting, skipping duplicate reconnection attempt');
          return;
      }

      this.isReconnecting = true;
      console.debug('Reconnection attempt will start after', reconnectIntervalSeconds, 'seconds');
      setTimeout(async () => {
          console.debug('Attempting to re-subscribe...');
          try {
              this.cancel();  // Cancel any existing subscription before re-subscribing
              await cqClient.subscribeToCommands(this);
              console.debug('Re-subscribed successfully');
              this.isReconnecting = false;  // Reset the flag on successful reconnection
          } catch (error) {
              console.error('Re-subscribe attempt failed', error);
              this.isReconnecting = false;  // Reset the flag on failure
          }
      }, reconnectIntervalSeconds * 1000);
  }
}


export interface CommandsResponse {
  id: string;
  replyChannel?: string;
  clientId: string;
  timestamp: number;
  executed: boolean;
  error: string;
}

