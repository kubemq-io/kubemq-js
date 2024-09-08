// src/cq/queryTypes.ts

import { BaseMessage } from '../client/KubeMQClient';
import { TypedEvent } from '../client/KubeMQClient';

export interface QueriesMessage extends BaseMessage {
  timeout?: number;
  cacheKey?: string;
  cacheTTL?: number;
}

export interface QueriesReceiveMessage {
  id: string;
  channel: string;
  metadata: string;
  body: Uint8Array | string;
  tags: Map<string, string>;
  replyChannel: string;
}

export interface QueriesResponse {
  id: string;
  replyChannel?: string;
  clientId: string;
  timestamp: number;
  executed: boolean;
  error: string;
  metadata?: string;
  body?: Uint8Array | string;
  tags?: Map<string, string>;
}

export interface QueriesSubscriptionRequest {
  channel: string;
  group?: string;
  clientId?: string;
}

export interface QueriesReceiveMessageCallback {
  (err: Error | null, msg: QueriesReceiveMessage): void;
}

export interface QueriesSubscriptionResponse {
  onState: TypedEvent<string>;
  unsubscribe(): void;
}
