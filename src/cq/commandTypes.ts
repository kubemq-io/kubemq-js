// types.ts


import { BaseMessage,TypedEvent } from '../client/KubeMQClient';

export interface CommandsMessage extends BaseMessage {
  timeout?: number;
}

export interface CommandsReceiveMessage {
  id: string;
  channel: string;
  metadata: string;
  body: Uint8Array | string;
  tags: Map<string, string>;
  replyChannel: string;
}

export interface CommandsResponse {
  id: string;
  replyChannel?: string;
  clientId: string;
  timestamp: number;
  executed: boolean;
  error: string;
}

export interface CommandsReceiveMessageCallback {
  (err: Error | null, msg: CommandsReceiveMessage): void;
}

export interface CommandsSubscriptionRequest {
  channel: string;
  group?: string;
  clientId?: string;
}

export interface CommandsSubscriptionResponse {
  onState: TypedEvent<string>;
  unsubscribe(): void;
}
