/** @internal — SDK ↔ protobuf message conversion */

import { randomUUID } from 'node:crypto';
import { kubemq } from '../../protos/kubemq.js';
import type { EventMessage } from '../../messages/events.js';
import type { ReceivedEvent } from '../../messages/events.js';
import type {
  EventStoreMessage,
  ReceivedEventStore,
  EventStoreSubscription,
} from '../../messages/events-store.js';
import type {
  QueueMessage,
  ReceivedQueueMessage,
  QueueSendResult,
  QueuePollRequest,
  QueueStreamOptions,
} from '../../messages/queues.js';
import type { BatchSendResult } from '../../messages/queues.js';
import type { CommandMessage, ReceivedCommand, CommandResponse } from '../../messages/commands.js';
import type { QueryMessage, ReceivedQuery, QueryResponse } from '../../messages/queries.js';
import type { ServerInfo } from '../../client.js';
import { normalizeBody } from '../utils/body.js';
import { KubeMQError, ErrorCode } from '../../errors.js';

// ─── Helper: Record<string,string> → Map<string,string> ─────────────

function toTagsMap(tags?: Record<string, string>): Map<string, string> {
  const map = new Map<string, string>();
  if (tags) {
    for (const [k, v] of Object.entries(tags)) {
      map.set(k, v);
    }
  }
  return map;
}

function fromTagsMap(
  tags: Map<string, string> | Record<string, string> | undefined | null,
): Record<string, string> {
  if (!tags) return {};
  if (tags instanceof Map) {
    const result: Record<string, string> = {};
    tags.forEach((v, k) => {
      result[k] = v;
    });
    return result;
  }
  return { ...tags };
}

function bodyBytes(body: unknown): Uint8Array {
  if (body === undefined || body === null) return new Uint8Array(0);
  if (typeof body === 'string') return normalizeBody(body);
  if (body instanceof Uint8Array) return body;
  if (Buffer.isBuffer(body)) return normalizeBody(body);
  return new Uint8Array(0);
}

// ─── SDK → Proto ─────────────────────────────────────────────────────

export function toProtoEvent(
  msg: EventMessage | EventStoreMessage,
  clientId: string,
  store: boolean,
): kubemq.Event {
  return new kubemq.Event({
    EventID: msg.id ?? randomUUID(),
    ClientID: msg.clientId ?? clientId,
    Channel: msg.channel,
    Metadata: msg.metadata ?? '',
    Body: msg.body !== undefined ? bodyBytes(msg.body) : new Uint8Array(0),
    Store: store,
    Tags: toTagsMap(msg.tags),
  });
}

export function toProtoSubscribeEvents(
  channel: string,
  group: string | undefined,
  clientId: string,
): kubemq.Subscribe {
  return new kubemq.Subscribe({
    SubscribeTypeData: kubemq.Subscribe.SubscribeType.Events,
    ClientID: clientId,
    Channel: channel,
    Group: group ?? '',
  });
}

export function toProtoSubscribeEventsStore(
  sub: EventStoreSubscription,
  clientId: string,
): kubemq.Subscribe {
  return new kubemq.Subscribe({
    SubscribeTypeData: kubemq.Subscribe.SubscribeType.EventsStore,
    ClientID: clientId,
    Channel: sub.channel,
    Group: sub.group ?? '',
    EventsStoreTypeData: sub.startFrom as number as kubemq.Subscribe.EventsStoreType,
    EventsStoreTypeValue: sub.startValue ?? 0,
  });
}

export function toProtoSubscribeCommands(
  channel: string,
  group: string | undefined,
  clientId: string,
): kubemq.Subscribe {
  return new kubemq.Subscribe({
    SubscribeTypeData: kubemq.Subscribe.SubscribeType.Commands,
    ClientID: clientId,
    Channel: channel,
    Group: group ?? '',
  });
}

export function toProtoSubscribeQueries(
  channel: string,
  group: string | undefined,
  clientId: string,
): kubemq.Subscribe {
  return new kubemq.Subscribe({
    SubscribeTypeData: kubemq.Subscribe.SubscribeType.Queries,
    ClientID: clientId,
    Channel: channel,
    Group: group ?? '',
  });
}

export function toProtoRequest(
  msg: CommandMessage | QueryMessage,
  clientId: string,
  type: 'Command' | 'Query',
): kubemq.Request {
  const req = new kubemq.Request({
    RequestID: msg.id ?? randomUUID(),
    RequestTypeData:
      type === 'Command' ? kubemq.Request.RequestType.Command : kubemq.Request.RequestType.Query,
    ClientID: msg.clientId ?? clientId,
    Channel: msg.channel,
    Metadata: msg.metadata ?? '',
    Body: msg.body !== undefined ? bodyBytes(msg.body) : new Uint8Array(0),
    Timeout: msg.timeoutMs,
    Tags: toTagsMap(msg.tags),
  });

  if (type === 'Query') {
    const queryMsg = msg as QueryMessage;
    if (queryMsg.cacheKey) req.CacheKey = queryMsg.cacheKey;
    if (queryMsg.cacheTTL) req.CacheTTL = queryMsg.cacheTTL;
  }

  const msgRecord = msg as unknown as Record<string, unknown>;
  if (msgRecord.span) req.Span = msgRecord.span as Uint8Array;

  return req;
}

export function toProtoResponse(
  resp: CommandResponse | QueryResponse,
  clientId: string,
): kubemq.Response {
  const pbResp = new kubemq.Response({
    ClientID: resp.clientId ?? clientId,
    RequestID: resp.id,
    ReplyChannel: resp.replyChannel,
    Executed: resp.executed,
    Error: resp.error ?? '',
    Tags: toTagsMap(resp.tags),
    Timestamp: resp.timestamp ? resp.timestamp.getTime() : Date.now(),
  });

  const queryResp = resp as QueryResponse;
  if (queryResp.metadata) pbResp.Metadata = queryResp.metadata;
  if (queryResp.body) pbResp.Body = queryResp.body;

  const respRecord = resp as unknown as Record<string, unknown>;
  if (respRecord.span) pbResp.Span = respRecord.span as Uint8Array;

  return pbResp;
}

export function toProtoQueueMessage(msg: QueueMessage, clientId: string): kubemq.QueueMessage {
  const pbMsg = new kubemq.QueueMessage({
    MessageID: msg.id ?? randomUUID(),
    ClientID: msg.clientId ?? clientId,
    Channel: msg.channel,
    Metadata: msg.metadata ?? '',
    Body: msg.body !== undefined ? bodyBytes(msg.body) : new Uint8Array(0),
    Tags: toTagsMap(msg.tags),
  });

  if (msg.policy) {
    pbMsg.Policy = new kubemq.QueueMessagePolicy({
      ExpirationSeconds: msg.policy.expirationSeconds ?? 0,
      DelaySeconds: msg.policy.delaySeconds ?? 0,
      MaxReceiveCount: msg.policy.maxReceiveCount ?? 0,
      MaxReceiveQueue: msg.policy.maxReceiveQueue ?? '',
    });
  }

  return pbMsg;
}

export function toProtoReceiveQueueRequest(
  req: QueuePollRequest,
  clientId: string,
): kubemq.ReceiveQueueMessagesRequest {
  return new kubemq.ReceiveQueueMessagesRequest({
    RequestID: randomUUID(),
    ClientID: clientId,
    Channel: req.channel,
    MaxNumberOfMessages: req.maxMessages ?? 1,
    WaitTimeSeconds: req.waitTimeoutSeconds,
    IsPeak: false,
  });
}

export function toProtoBatchRequest(
  messages: kubemq.QueueMessage[],
): kubemq.QueueMessagesBatchRequest {
  return new kubemq.QueueMessagesBatchRequest({
    BatchID: randomUUID(),
    Messages: messages,
  });
}

// ─── Proto → SDK ─────────────────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-unnecessary-condition */

export function fromProtoPingResult(result: kubemq.PingResult): ServerInfo {
  return {
    host: result.Host,
    version: result.Version,
    serverStartTime: Number(result.ServerStartTime),
    serverUpTime: Number(result.ServerUpTimeSeconds),
  };
}

export function fromProtoResult(result: kubemq.Result, operation: string): void {
  if (!result.Sent) {
    throw new KubeMQError({
      code: ErrorCode.Fatal,
      message: result.Error || 'Event send failed',
      operation,
      isRetryable: false,
    });
  }
}

export function fromProtoReceivedEvent(data: kubemq.EventReceive): ReceivedEvent {
  return {
    id: data.EventID,
    channel: data.Channel,
    timestamp: new Date(Number(data.Timestamp) / 1_000_000),
    body: data.Body instanceof Uint8Array ? data.Body : new Uint8Array(0),
    metadata: data.Metadata,
    tags: fromTagsMap(data.Tags),
  };
}

export function fromProtoReceivedEventStore(data: kubemq.EventReceive): ReceivedEventStore {
  return {
    id: data.EventID,
    channel: data.Channel,
    timestamp: new Date(Number(data.Timestamp) / 1_000_000),
    body: data.Body instanceof Uint8Array ? data.Body : new Uint8Array(0),
    metadata: data.Metadata,
    tags: fromTagsMap(data.Tags),
    sequence: Number(data.Sequence),
  };
}

export function fromProtoReceivedCommand(data: kubemq.Request): ReceivedCommand {
  return {
    id: data.RequestID,
    channel: data.Channel,
    fromClientId: data.ClientID,
    timestamp: new Date(),
    body: data.Body instanceof Uint8Array ? data.Body : new Uint8Array(0),
    metadata: data.Metadata,
    replyChannel: data.ReplyChannel,
    tags: fromTagsMap(data.Tags),
  };
}

export function fromProtoReceivedQuery(data: kubemq.Request): ReceivedQuery {
  return {
    id: data.RequestID,
    channel: data.Channel,
    fromClientId: data.ClientID,
    timestamp: new Date(),
    body: data.Body instanceof Uint8Array ? data.Body : new Uint8Array(0),
    metadata: data.Metadata,
    replyChannel: data.ReplyChannel,
    tags: fromTagsMap(data.Tags),
  };
}

export function fromProtoCommandResponse(data: kubemq.Response): CommandResponse {
  return {
    id: data.RequestID,
    replyChannel: data.ReplyChannel,
    clientId: data.ClientID || undefined,
    executed: data.Executed,
    error: data.Error || undefined,
    metadata: data.Metadata || undefined,
    body: data.Body instanceof Uint8Array && data.Body.length > 0 ? data.Body : undefined,
    tags: fromTagsMap(data.Tags),
    timestamp: data.Timestamp ? new Date(Number(data.Timestamp)) : undefined,
  };
}

export function fromProtoQueryResponse(data: kubemq.Response): QueryResponse {
  return {
    id: data.RequestID,
    replyChannel: data.ReplyChannel,
    clientId: data.ClientID || undefined,
    executed: data.Executed,
    error: data.Error || undefined,
    metadata: data.Metadata || undefined,
    body: data.Body instanceof Uint8Array && data.Body.length > 0 ? data.Body : undefined,
    tags: fromTagsMap(data.Tags),
    timestamp: data.Timestamp ? new Date(Number(data.Timestamp)) : undefined,
    cacheHit: data.CacheHit,
  };
}

export function fromProtoQueueSendResult(
  result: kubemq.SendQueueMessageResult,
  operation: string,
): QueueSendResult {
  if (result.IsError) {
    throw new KubeMQError({
      code: ErrorCode.Fatal,
      message: result.Error || 'Queue send failed',
      operation,
      isRetryable: false,
    });
  }
  return {
    messageId: result.MessageID,
    sentAt: new Date(Number(result.SentAt) / 1e6),
    expirationAt: result.ExpirationAt ? new Date(Number(result.ExpirationAt) / 1e6) : undefined,
    delayedTo: result.DelayedTo ? new Date(Number(result.DelayedTo) / 1e6) : undefined,
  };
}

export function fromProtoBatchResponse(
  response: kubemq.QueueMessagesBatchResponse,
): BatchSendResult {
  const results = (response.Results || []).map((r, index) => ({
    index,
    messageId: r.IsError ? undefined : r.MessageID || undefined,
    error: r.IsError
      ? new KubeMQError({
          code: ErrorCode.Fatal,
          message: r.Error || 'Batch item failed',
          operation: 'sendQueueMessagesBatch',
          isRetryable: false,
        })
      : undefined,
  }));

  const successCount = results.filter((r) => !r.error).length;
  return {
    results,
    successCount,
    failureCount: results.length - successCount,
  };
}

export function fromProtoReceivedQueueMessage(
  msg: kubemq.QueueMessage,
): Omit<ReceivedQueueMessage, 'ack' | 'reject' | 'reQueue'> {
  const attrs = msg.Attributes;
  return {
    id: msg.MessageID,
    channel: msg.Channel,
    fromClientId: msg.ClientID,
    body: msg.Body instanceof Uint8Array ? msg.Body : new Uint8Array(0),
    metadata: msg.Metadata,
    tags: fromTagsMap(msg.Tags),
    timestamp: attrs ? new Date(Number(attrs.Timestamp) / 1_000_000) : new Date(),
    sequence: attrs ? Number(attrs.Sequence) : 0,
    receiveCount: attrs ? attrs.ReceiveCount : 0,
    isReRouted: attrs ? attrs.ReRouted : false,
    reRouteFromQueue: attrs?.ReRoutedFromQueue || undefined,
    expiredAt: attrs?.ExpirationAt ? new Date(Number(attrs.ExpirationAt) / 1e6) : undefined,
    delayedTo: attrs?.DelayedTo ? new Date(Number(attrs.DelayedTo) / 1e6) : undefined,
  };
}

export function fromProtoReceiveQueueResponse(
  response: kubemq.ReceiveQueueMessagesResponse,
  operation: string,
): Omit<ReceivedQueueMessage, 'ack' | 'reject' | 'reQueue'>[] {
  if (response.IsError) {
    throw new KubeMQError({
      code: ErrorCode.Fatal,
      message: response.Error || 'Queue receive failed',
      operation,
      isRetryable: false,
    });
  }
  return (response.Messages || []).map(fromProtoReceivedQueueMessage);
}

export function toProtoQueuesUpstreamRequest(
  msgs: QueueMessage[],
  clientId: string,
): kubemq.QueuesUpstreamRequest {
  return new kubemq.QueuesUpstreamRequest({
    RequestID: randomUUID(),
    Messages: msgs.map((m) => toProtoQueueMessage(m, clientId)),
  });
}

export function fromProtoQueuesUpstreamResponse(
  response: kubemq.QueuesUpstreamResponse,
  _operation: string,
): { requestId: string; results: QueueSendResult[]; isError: boolean; error?: string } {
  return {
    requestId: response.RefRequestID,
    results: (response.Results || []).map((r) => ({
      messageId: r.MessageID,
      sentAt: new Date(Number(r.SentAt) / 1e6),
      expirationAt: r.ExpirationAt ? new Date(Number(r.ExpirationAt) / 1e6) : undefined,
      delayedTo: r.DelayedTo ? new Date(Number(r.DelayedTo) / 1e6) : undefined,
    })),
    isError: response.IsError,
    error: response.Error || undefined,
  };
}

export function toProtoQueuesDownstreamRequest(
  opts: QueueStreamOptions,
  clientId: string,
): kubemq.QueuesDownstreamRequest {
  const req = new kubemq.QueuesDownstreamRequest({
    RequestID: randomUUID(),
    ClientID: clientId,
    Channel: opts.channel,
    MaxItems: opts.maxMessages ?? 1,
    WaitTimeout: (opts.waitTimeoutSeconds ?? 5) * 1000,
    AutoAck: opts.autoAck ?? false,
    RequestTypeData: 1,
  });
  if (opts.metadata) {
    const map = new Map<string, string>();
    for (const [k, v] of Object.entries(opts.metadata)) {
      map.set(k, v);
    }
    req.Metadata = map;
  }
  return req;
}

export { fromTagsMap, toTagsMap };
