// types.ts
import { BaseMessage, TypedEvent } from '../client/KubeMQClient';
import * as pb from '../protos';
import * as grpc from '@grpc/grpc-js';
import { CQClient } from './CQClient';

// CommandsMessage interface extending BaseMessage
export interface CommandsMessage extends BaseMessage {
  timeout?: number;  // Optional timeout field for command message
}

// CommandMessageReceived class representing a received command message
export class CommandMessageReceived {
  id: string;  // Unique identifier for the command message
  fromClientId: string;  // Client ID that sent the command
  timestamp: Date;  // Timestamp when the command was received
  channel: string;  // Channel from which the command was received
  metadata: string;  // Metadata associated with the command
  body: Uint8Array | string;  // Body of the received command
  replyChannel: string;  // Reply channel for the command
  tags: Map<string, string>;  // Key-value pairs of tags for the command

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

  // Static method to decode a protocol buffer request into a CommandMessageReceived instance
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

// CommandsSubscriptionRequest class to handle subscription requests for commands
export class CommandsSubscriptionRequest {
  channel: string;  // Channel to subscribe to
  group?: string;  // Optional group for subscription
  onReceiveEventCallback?: (event: CommandMessageReceived) => void;  // Callback for receiving events
  onErrorCallback?: (error: string) => void;  // Callback for handling errors
  observer?: grpc.ClientReadableStream<pb.kubemq.Request>;  // Observer for the subscription stream
  isReconnecting: boolean = false;  // Flag to track if reconnection is in progress

  constructor(channel: string, group?: string) {
    this.channel = channel;
    this.group = group;
  }

  // Validate the subscription request
  validate() {
    if (!this.channel || !this.onReceiveEventCallback) {
      throw new Error('Event subscription must have a channel and onReceiveEventCallback.');
    }
  }

  // Encode the subscription request into a protocol buffer Subscribe message
  encode(cqClient: CQClient): pb.kubemq.Subscribe {
    const subscribe = new pb.kubemq.Subscribe();
    subscribe.ClientID = cqClient.clientId;
    subscribe.Channel = this.channel;
    subscribe.Group = this.group || '';
    subscribe.SubscribeTypeData = pb.kubemq.Subscribe.SubscribeType.Commands;

    return subscribe;
  }

  // Raise an event when a command message is received
  raiseOnReceiveMessage(event: CommandMessageReceived) {
    if (this.onReceiveEventCallback) {
      this.onReceiveEventCallback(event);
    }
  }

  // Raise an error when a subscription error occurs
  raiseOnError(errorMsg: string) {
    if (this.onErrorCallback) {
      this.onErrorCallback(errorMsg);
    }
  }

  // Cancel the current subscription
  cancel() {
    if (this.observer) {
      this.observer.cancel();
      console.debug('Subscription cancelled');
    }
  }

  // Reconnect logic for handling subscription disconnection
  reconnect(cqClient: CQClient, reconnectIntervalSeconds: number) {
    if (this.isReconnecting) {
      console.debug('Already reconnecting, skipping duplicate reconnection attempt');
      return;
    }

    this.isReconnecting = true;
    console.debug(`Reconnection attempt will start after ${reconnectIntervalSeconds} seconds`);
    setTimeout(async () => {
      console.debug('Attempting to re-subscribe...');
      try {
        this.cancel();  // Cancel existing subscription before re-subscribing
        await cqClient.subscribeToCommands(this);
        console.debug('Re-subscribed successfully');
        this.isReconnecting = false;  // Reset reconnection flag
      } catch (error) {
        console.error('Re-subscribe attempt failed', error);
        this.isReconnecting = false;  // Reset reconnection flag on failure
      }
    }, reconnectIntervalSeconds * 1000);
  }
}

// CommandsResponse interface to represent the response of a command
export interface CommandsResponse {
  id: string;  // Unique identifier of the command response
  replyChannel?: string;  // Optional reply channel
  clientId: string;  // Client ID that received the response
  timestamp: number;  // Timestamp of the response
  executed: boolean;  // Whether the command was successfully executed
  error: string;  // Error message if the command failed
}
