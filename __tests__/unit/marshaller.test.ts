import { describe, it, expect } from 'vitest';
// randomUUID imported but not directly used in tests
import {
  toProtoEvent,
  toProtoRequest,
  toProtoResponse,
  toProtoQueueMessage,
  toProtoReceiveQueueRequest,
  toProtoBatchRequest,
  toProtoSubscribeEvents,
  toProtoSubscribeEventsStore,
  toProtoSubscribeCommands,
  toProtoSubscribeQueries,
  toProtoQueuesDownstreamRequest,
  fromProtoPingResult,
  fromProtoResult,
  fromProtoReceivedEvent,
  fromProtoReceivedEventStore,
  fromProtoReceivedCommand,
  fromProtoReceivedQuery,
  fromProtoCommandResponse,
  fromProtoQueryResponse,
  fromProtoQueueSendResult,
  fromProtoBatchResponse,
  fromProtoReceivedQueueMessage,
  fromProtoReceiveQueueResponse,
  fromTagsMap,
  toProtoQueuesUpstreamRequest,
  fromProtoQueuesUpstreamResponse,
} from '../../src/internal/protocol/marshaller.js';
import { kubemq } from '../../src/protos/kubemq.js';
import { KubeMQError } from '../../src/errors.js';
import { EventStoreType } from '../../src/messages/events-store.js';

const CLIENT_ID = 'test-client';
const encoder = new TextEncoder();

describe('marshaller', () => {
  // ─── SDK → Proto ─────────────────────────────────────────────────

  describe('toProtoEvent', () => {
    it('converts EventMessage to proto Event, preserving channel/body/metadata/tags', () => {
      const msg = {
        channel: 'events.test',
        body: encoder.encode('hello'),
        metadata: 'meta-1',
        tags: { env: 'test' },
        id: 'evt-1',
      };
      const proto = toProtoEvent(msg, CLIENT_ID, false);

      expect(proto.EventID).toBe('evt-1');
      expect(proto.ClientID).toBe(CLIENT_ID);
      expect(proto.Channel).toBe('events.test');
      expect(proto.Metadata).toBe('meta-1');
      expect(proto.Store).toBe(false);
      expect(proto.Body).toEqual(encoder.encode('hello'));
      expect(proto.Tags.get('env')).toBe('test');
    });

    it('auto-generates EventID if not provided', () => {
      const msg = { channel: 'events.auto' };
      const proto = toProtoEvent(msg, CLIENT_ID, false);

      expect(proto.EventID).toBeDefined();
      expect(proto.EventID.length).toBeGreaterThan(0);
    });

    it('sets Store=true for event-store messages', () => {
      const msg = { channel: 'events-store.test', body: encoder.encode('data') };
      const proto = toProtoEvent(msg, CLIENT_ID, true);

      expect(proto.Store).toBe(true);
    });

    it('uses msg.clientId when provided, falling back to default', () => {
      const msg = { channel: 'ch', clientId: 'custom-client' };
      const proto = toProtoEvent(msg, CLIENT_ID, false);

      expect(proto.ClientID).toBe('custom-client');
    });

    it('handles empty body and metadata', () => {
      const msg = { channel: 'ch' };
      const proto = toProtoEvent(msg, CLIENT_ID, false);

      expect(proto.Metadata).toBe('');
      expect(proto.Body).toEqual(new Uint8Array(0));
    });

    it('handles string body via normalizeBody', () => {
      const msg = { channel: 'ch', body: 'string-body' };
      const proto = toProtoEvent(msg, CLIENT_ID, false);

      expect(proto.Body).toEqual(encoder.encode('string-body'));
    });
  });

  describe('toProtoRequest', () => {
    it('converts CommandMessage to proto Request with Command type', () => {
      const msg = {
        channel: 'cmd.test',
        body: encoder.encode('cmd-body'),
        metadata: 'cmd-meta',
        timeoutMs: 5000,
        tags: { action: 'run' },
        id: 'req-1',
      };
      const proto = toProtoRequest(msg, CLIENT_ID, 'Command');

      expect(proto.RequestID).toBe('req-1');
      expect(proto.RequestTypeData).toBe(kubemq.Request.RequestType.Command);
      expect(proto.Channel).toBe('cmd.test');
      expect(proto.Metadata).toBe('cmd-meta');
      expect(proto.Timeout).toBe(5000);
      expect(proto.Body).toEqual(encoder.encode('cmd-body'));
      expect(proto.Tags.get('action')).toBe('run');
    });

    it('converts QueryMessage to proto Request with Query type and cache fields', () => {
      const msg = {
        channel: 'query.test',
        body: encoder.encode('q-body'),
        metadata: 'q-meta',
        timeoutMs: 3000,
        cacheKey: 'cache-key-1',
        cacheTTL: 60,
        id: 'q-1',
      };
      const proto = toProtoRequest(msg, CLIENT_ID, 'Query');

      expect(proto.RequestTypeData).toBe(kubemq.Request.RequestType.Query);
      expect(proto.CacheKey).toBe('cache-key-1');
      expect(proto.CacheTTL).toBe(60);
    });

    it('auto-generates RequestID if not provided', () => {
      const msg = { channel: 'cmd.auto', timeoutMs: 1000 };
      const proto = toProtoRequest(msg, CLIENT_ID, 'Command');

      expect(proto.RequestID.length).toBeGreaterThan(0);
    });

    it('does not set cache fields for Command type', () => {
      const msg = { channel: 'cmd.nocache', timeoutMs: 1000, cacheKey: 'ignored', cacheTTL: 30 };
      const proto = toProtoRequest(msg, CLIENT_ID, 'Command');

      expect(proto.CacheKey).toBe('');
      expect(proto.CacheTTL).toBe(0);
    });
  });

  describe('toProtoResponse', () => {
    it('converts CommandResponse to proto Response', () => {
      const resp = {
        id: 'resp-1',
        replyChannel: 'reply-ch',
        clientId: 'responder',
        executed: true,
        error: '',
        tags: { status: 'ok' },
        timestamp: new Date(1700000000000),
      };
      const proto = toProtoResponse(resp, CLIENT_ID);

      expect(proto.RequestID).toBe('resp-1');
      expect(proto.ReplyChannel).toBe('reply-ch');
      expect(proto.ClientID).toBe('responder');
      expect(proto.Executed).toBe(true);
      expect(proto.Error).toBe('');
      expect(proto.Tags.get('status')).toBe('ok');
      expect(proto.Timestamp).toBe(1700000000000);
    });

    it('uses default clientId when resp.clientId is undefined', () => {
      const resp = { id: 'resp-2', replyChannel: 'reply', executed: false };
      const proto = toProtoResponse(resp, CLIENT_ID);

      expect(proto.ClientID).toBe(CLIENT_ID);
    });

    it('sets Metadata and Body from QueryResponse fields', () => {
      const body = encoder.encode('query-response-body');
      const resp = {
        id: 'qr-1',
        replyChannel: 'reply',
        executed: true,
        metadata: 'qr-meta',
        body,
      };
      const proto = toProtoResponse(resp, CLIENT_ID);

      expect(proto.Metadata).toBe('qr-meta');
      expect(proto.Body).toEqual(body);
    });
  });

  describe('toProtoQueueMessage', () => {
    it('converts QueueMessage with all fields', () => {
      const msg = {
        channel: 'queue.test',
        body: encoder.encode('q-body'),
        metadata: 'q-meta',
        tags: { priority: 'high' },
        id: 'qm-1',
      };
      const proto = toProtoQueueMessage(msg, CLIENT_ID);

      expect(proto.MessageID).toBe('qm-1');
      expect(proto.ClientID).toBe(CLIENT_ID);
      expect(proto.Channel).toBe('queue.test');
      expect(proto.Metadata).toBe('q-meta');
      expect(proto.Body).toEqual(encoder.encode('q-body'));
      expect(proto.Tags.get('priority')).toBe('high');
      expect(proto.Policy).toBeUndefined();
    });

    it('sets policy when provided', () => {
      const msg = {
        channel: 'queue.policy',
        policy: {
          expirationSeconds: 30,
          delaySeconds: 5,
          maxReceiveCount: 3,
          maxReceiveQueue: 'dlq',
        },
      };
      const proto = toProtoQueueMessage(msg, CLIENT_ID);

      expect(proto.Policy).toBeDefined();
      expect(proto.Policy!.ExpirationSeconds).toBe(30);
      expect(proto.Policy!.DelaySeconds).toBe(5);
      expect(proto.Policy!.MaxReceiveCount).toBe(3);
      expect(proto.Policy!.MaxReceiveQueue).toBe('dlq');
    });

    it('auto-generates MessageID if not provided', () => {
      const msg = { channel: 'queue.auto' };
      const proto = toProtoQueueMessage(msg, CLIENT_ID);

      expect(proto.MessageID.length).toBeGreaterThan(0);
    });
  });

  describe('toProtoReceiveQueueRequest', () => {
    it('sets correct fields from QueuePollRequest', () => {
      const req = {
        channel: 'queue.poll',
        visibilitySeconds: 30,
        waitTimeoutSeconds: 10,
        maxMessages: 5,
      };
      const proto = toProtoReceiveQueueRequest(req, CLIENT_ID);

      expect(proto.ClientID).toBe(CLIENT_ID);
      expect(proto.Channel).toBe('queue.poll');
      expect(proto.MaxNumberOfMessages).toBe(5);
      expect(proto.WaitTimeSeconds).toBe(10);
      expect(proto.IsPeak).toBe(false);
      expect(proto.RequestID.length).toBeGreaterThan(0);
    });

    it('defaults maxMessages to 1 when not provided', () => {
      const req = {
        channel: 'queue.default',
        visibilitySeconds: 10,
        waitTimeoutSeconds: 5,
      };
      const proto = toProtoReceiveQueueRequest(req, CLIENT_ID);

      expect(proto.MaxNumberOfMessages).toBe(1);
    });
  });

  describe('toProtoBatchRequest', () => {
    it('wraps messages with auto-generated BatchID', () => {
      const msgs = [
        new kubemq.QueueMessage({ MessageID: 'm1', Channel: 'q1' }),
        new kubemq.QueueMessage({ MessageID: 'm2', Channel: 'q2' }),
      ];
      const batch = toProtoBatchRequest(msgs);

      expect(batch.BatchID.length).toBeGreaterThan(0);
      expect(batch.Messages).toHaveLength(2);
      expect(batch.Messages[0]!.MessageID).toBe('m1');
      expect(batch.Messages[1]!.MessageID).toBe('m2');
    });
  });

  describe('toProtoQueuesDownstreamRequest', () => {
    it('converts QueueStreamOptions to downstream request', () => {
      const opts = {
        channel: 'stream.ch',
        maxMessages: 10,
        waitTimeoutSeconds: 15,
        autoAck: true,
      };
      const proto = toProtoQueuesDownstreamRequest(opts, CLIENT_ID);

      expect(proto.ClientID).toBe(CLIENT_ID);
      expect(proto.Channel).toBe('stream.ch');
      expect(proto.MaxItems).toBe(10);
      expect(proto.WaitTimeout).toBe(15000);
      expect(proto.AutoAck).toBe(true);
      expect(proto.RequestTypeData).toBe(1);
    });

    it('applies defaults for optional fields', () => {
      const opts = { channel: 'stream.default' };
      const proto = toProtoQueuesDownstreamRequest(opts, CLIENT_ID);

      expect(proto.MaxItems).toBe(1);
      expect(proto.WaitTimeout).toBe(5000);
      expect(proto.AutoAck).toBe(false);
    });
  });

  // ─── Subscribe helpers ─────────────────────────────────────────────

  describe('subscribe helpers', () => {
    it('toProtoSubscribeEvents sets Events type', () => {
      const proto = toProtoSubscribeEvents('ch1', 'group1', CLIENT_ID);

      expect(proto.SubscribeTypeData).toBe(kubemq.Subscribe.SubscribeType.Events);
      expect(proto.ClientID).toBe(CLIENT_ID);
      expect(proto.Channel).toBe('ch1');
      expect(proto.Group).toBe('group1');
    });

    it('toProtoSubscribeEvents defaults group to empty string', () => {
      const proto = toProtoSubscribeEvents('ch2', undefined, CLIENT_ID);
      expect(proto.Group).toBe('');
    });

    it('toProtoSubscribeEventsStore sets EventsStore type with startFrom', () => {
      const sub = {
        channel: 'es-ch',
        group: 'g1',
        startFrom: EventStoreType.StartAtSequence,
        startValue: 42,
        onMessage: () => {},
        onError: () => {},
      };
      const proto = toProtoSubscribeEventsStore(sub, CLIENT_ID);

      expect(proto.SubscribeTypeData).toBe(kubemq.Subscribe.SubscribeType.EventsStore);
      expect(proto.Channel).toBe('es-ch');
      expect(proto.Group).toBe('g1');
      expect(proto.EventsStoreTypeValue).toBe(42);
    });

    it('toProtoSubscribeCommands sets Commands type', () => {
      const proto = toProtoSubscribeCommands('cmd-ch', 'grp', CLIENT_ID);

      expect(proto.SubscribeTypeData).toBe(kubemq.Subscribe.SubscribeType.Commands);
      expect(proto.Channel).toBe('cmd-ch');
      expect(proto.Group).toBe('grp');
    });

    it('toProtoSubscribeQueries sets Queries type', () => {
      const proto = toProtoSubscribeQueries('q-ch', undefined, CLIENT_ID);

      expect(proto.SubscribeTypeData).toBe(kubemq.Subscribe.SubscribeType.Queries);
      expect(proto.Channel).toBe('q-ch');
      expect(proto.Group).toBe('');
    });
  });

  // ─── Proto → SDK ─────────────────────────────────────────────────

  describe('fromProtoPingResult', () => {
    it('converts PingResult to ServerInfo', () => {
      const pingResult = new kubemq.PingResult({
        Host: 'kubemq-server',
        Version: '2.5.0',
        ServerStartTime: 1700000000,
        ServerUpTimeSeconds: 86400,
      });
      const info = fromProtoPingResult(pingResult);

      expect(info.host).toBe('kubemq-server');
      expect(info.version).toBe('2.5.0');
      expect(info.serverStartTime).toBe(1700000000);
      expect(info.serverUpTime).toBe(86400);
    });
  });

  describe('fromProtoResult', () => {
    it('throws KubeMQError on Sent=false', () => {
      const result = new kubemq.Result({ Sent: false, Error: 'publish failed' });

      expect(() => fromProtoResult(result, 'publishEvent')).toThrow(KubeMQError);
      expect(() => fromProtoResult(result, 'publishEvent')).toThrow('publish failed');
    });

    it('throws with default message when Error is empty', () => {
      const result = new kubemq.Result({ Sent: false, Error: '' });

      expect(() => fromProtoResult(result, 'publishEvent')).toThrow('Event send failed');
    });

    it('succeeds silently on Sent=true', () => {
      const result = new kubemq.Result({ Sent: true });

      expect(() => fromProtoResult(result, 'publishEvent')).not.toThrow();
    });
  });

  describe('fromProtoReceivedEvent', () => {
    it('converts EventReceive to ReceivedEvent', () => {
      const ts = BigInt(Date.now()) * BigInt(1_000_000);
      const data = new kubemq.EventReceive({
        EventID: 'evt-rx-1',
        Channel: 'events.rx',
        Body: encoder.encode('body-data'),
        Metadata: 'rx-meta',
        Tags: new Map([['k', 'v']]),
        Timestamp: Number(ts),
      });
      const event = fromProtoReceivedEvent(data);

      expect(event.id).toBe('evt-rx-1');
      expect(event.channel).toBe('events.rx');
      expect(event.metadata).toBe('rx-meta');
      expect(event.tags).toEqual({ k: 'v' });
      expect(event.body).toEqual(encoder.encode('body-data'));
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('defaults body to empty Uint8Array when not a Uint8Array', () => {
      const data = new kubemq.EventReceive({
        EventID: 'evt-2',
        Channel: 'ch',
        Timestamp: 0,
      });
      const event = fromProtoReceivedEvent(data);

      expect(event.body).toEqual(new Uint8Array(0));
    });
  });

  describe('fromProtoReceivedEventStore', () => {
    it('includes sequence number', () => {
      const data = new kubemq.EventReceive({
        EventID: 'es-rx-1',
        Channel: 'es.ch',
        Body: encoder.encode('es-body'),
        Metadata: 'es-meta',
        Timestamp: 0,
        Sequence: 42,
      });
      const event = fromProtoReceivedEventStore(data);

      expect(event.id).toBe('es-rx-1');
      expect(event.channel).toBe('es.ch');
      expect(event.sequence).toBe(42);
      expect(event.body).toEqual(encoder.encode('es-body'));
    });
  });

  describe('fromProtoReceivedCommand', () => {
    it('converts proto Request to ReceivedCommand', () => {
      const data = new kubemq.Request({
        RequestID: 'cmd-rx-1',
        Channel: 'cmd.ch',
        ClientID: 'sender-1',
        Body: encoder.encode('cmd-body'),
        Metadata: 'cmd-rx-meta',
        ReplyChannel: 'reply.cmd',
        Tags: new Map([['op', 'create']]),
      });
      const cmd = fromProtoReceivedCommand(data);

      expect(cmd.id).toBe('cmd-rx-1');
      expect(cmd.channel).toBe('cmd.ch');
      expect(cmd.fromClientId).toBe('sender-1');
      expect(cmd.replyChannel).toBe('reply.cmd');
      expect(cmd.metadata).toBe('cmd-rx-meta');
      expect(cmd.body).toEqual(encoder.encode('cmd-body'));
      expect(cmd.tags).toEqual({ op: 'create' });
      expect(cmd.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('fromProtoReceivedQuery', () => {
    it('converts proto Request to ReceivedQuery', () => {
      const data = new kubemq.Request({
        RequestID: 'qry-rx-1',
        Channel: 'query.ch',
        ClientID: 'sender-2',
        Body: encoder.encode('query-body'),
        Metadata: 'query-rx-meta',
        ReplyChannel: 'reply.query',
        Tags: new Map([['type', 'lookup']]),
      });
      const query = fromProtoReceivedQuery(data);

      expect(query.id).toBe('qry-rx-1');
      expect(query.channel).toBe('query.ch');
      expect(query.fromClientId).toBe('sender-2');
      expect(query.replyChannel).toBe('reply.query');
      expect(query.metadata).toBe('query-rx-meta');
      expect(query.body).toEqual(encoder.encode('query-body'));
      expect(query.tags).toEqual({ type: 'lookup' });
    });
  });

  describe('fromProtoCommandResponse', () => {
    it('converts proto Response to CommandResponse', () => {
      const ts = Date.now();
      const data = new kubemq.Response({
        RequestID: 'cresp-1',
        ReplyChannel: 'reply.cmd',
        ClientID: 'handler-1',
        Executed: true,
        Error: '',
        Tags: new Map([['result', 'ok']]),
        Timestamp: ts,
      });
      const resp = fromProtoCommandResponse(data);

      expect(resp.id).toBe('cresp-1');
      expect(resp.replyChannel).toBe('reply.cmd');
      expect(resp.clientId).toBe('handler-1');
      expect(resp.executed).toBe(true);
      expect(resp.error).toBeUndefined();
      expect(resp.tags).toEqual({ result: 'ok' });
      expect(resp.timestamp).toEqual(new Date(ts));
    });

    it('sets clientId to undefined when empty', () => {
      const data = new kubemq.Response({
        RequestID: 'cresp-2',
        ReplyChannel: 'reply',
        Executed: false,
        Error: 'some error',
        ClientID: '',
      });
      const resp = fromProtoCommandResponse(data);

      expect(resp.clientId).toBeUndefined();
      expect(resp.error).toBe('some error');
    });
  });

  describe('fromProtoQueryResponse', () => {
    it('includes metadata and body', () => {
      const body = encoder.encode('result-data');
      const data = new kubemq.Response({
        RequestID: 'qresp-1',
        ReplyChannel: 'reply.q',
        Executed: true,
        Metadata: 'resp-meta',
        Body: body,
        Tags: new Map([['cached', 'true']]),
        Timestamp: 1700000000000,
      });
      const resp = fromProtoQueryResponse(data);

      expect(resp.id).toBe('qresp-1');
      expect(resp.executed).toBe(true);
      expect(resp.metadata).toBe('resp-meta');
      expect(resp.body).toEqual(body);
      expect(resp.tags).toEqual({ cached: 'true' });
    });

    it('returns undefined for body when empty', () => {
      const data = new kubemq.Response({
        RequestID: 'qresp-2',
        ReplyChannel: 'reply',
        Executed: true,
        Body: new Uint8Array(0),
      });
      const resp = fromProtoQueryResponse(data);

      expect(resp.body).toBeUndefined();
    });

    it('returns undefined for metadata when empty', () => {
      const data = new kubemq.Response({
        RequestID: 'qresp-3',
        ReplyChannel: 'reply',
        Executed: true,
        Metadata: '',
      });
      const resp = fromProtoQueryResponse(data);

      expect(resp.metadata).toBeUndefined();
    });
  });

  describe('fromProtoQueueSendResult', () => {
    it('throws KubeMQError on IsError=true', () => {
      const result = new kubemq.SendQueueMessageResult({
        IsError: true,
        Error: 'queue full',
        MessageID: 'qm-err',
      });

      expect(() => fromProtoQueueSendResult(result, 'sendQueueMessage')).toThrow(KubeMQError);
      expect(() => fromProtoQueueSendResult(result, 'sendQueueMessage')).toThrow('queue full');
    });

    it('throws with default message when Error is empty', () => {
      const result = new kubemq.SendQueueMessageResult({ IsError: true, Error: '' });

      expect(() => fromProtoQueueSendResult(result, 'sendQueueMessage')).toThrow(
        'Queue send failed',
      );
    });

    it('returns QueueSendResult on success with nanosecond timestamps', () => {
      // Server sends timestamps in nanoseconds
      const nowMs = Date.now();
      const sentAtNs = nowMs * 1e6;
      const expirationAtNs = (nowMs + 60_000) * 1e6;
      const delayedToNs = (nowMs + 10_000) * 1e6;
      const result = new kubemq.SendQueueMessageResult({
        IsError: false,
        MessageID: 'qm-ok',
        SentAt: sentAtNs,
        ExpirationAt: expirationAtNs,
        DelayedTo: delayedToNs,
      });
      const out = fromProtoQueueSendResult(result, 'sendQueueMessage');

      expect(out.messageId).toBe('qm-ok');
      expect(out.sentAt).toBeInstanceOf(Date);
      expect(out.expirationAt).toBeInstanceOf(Date);
      expect(out.delayedTo).toBeInstanceOf(Date);
      // Verify nanosecond→millisecond conversion: sentAt should be close to nowMs
      expect(Math.abs(out.sentAt.getTime() - nowMs)).toBeLessThan(10);
      expect(Math.abs(out.expirationAt!.getTime() - (nowMs + 60_000))).toBeLessThan(10);
      expect(Math.abs(out.delayedTo!.getTime() - (nowMs + 10_000))).toBeLessThan(10);
    });

    it('sentAt correctly converts nanoseconds to JS Date', () => {
      // A known timestamp: 2025-01-15T00:00:00.000Z
      const knownMs = new Date('2025-01-15T00:00:00.000Z').getTime();
      const knownNs = knownMs * 1e6;
      const result = new kubemq.SendQueueMessageResult({
        IsError: false,
        MessageID: 'qm-ts',
        SentAt: knownNs,
        ExpirationAt: 0,
        DelayedTo: 0,
      });
      const out = fromProtoQueueSendResult(result, 'sendQueueMessage');

      expect(out.sentAt.getTime()).toBe(knownMs);
      expect(out.sentAt.toISOString()).toBe('2025-01-15T00:00:00.000Z');
    });

    it('returns undefined for optional dates when zero', () => {
      const result = new kubemq.SendQueueMessageResult({
        IsError: false,
        MessageID: 'qm-nodates',
        SentAt: Date.now() * 1e6,
        ExpirationAt: 0,
        DelayedTo: 0,
      });
      const out = fromProtoQueueSendResult(result, 'sendQueueMessage');

      expect(out.expirationAt).toBeUndefined();
      expect(out.delayedTo).toBeUndefined();
    });

    it('delayedTo is undefined when 0 but defined when non-zero', () => {
      const nowNs = Date.now() * 1e6;
      const resultZero = new kubemq.SendQueueMessageResult({
        IsError: false,
        MessageID: 'qm-delay-zero',
        SentAt: nowNs,
        DelayedTo: 0,
      });
      expect(fromProtoQueueSendResult(resultZero, 'test').delayedTo).toBeUndefined();

      const delayNs = (Date.now() + 5000) * 1e6;
      const resultNonZero = new kubemq.SendQueueMessageResult({
        IsError: false,
        MessageID: 'qm-delay-nonzero',
        SentAt: nowNs,
        DelayedTo: delayNs,
      });
      const delayResult = fromProtoQueueSendResult(resultNonZero, 'test');
      expect(delayResult.delayedTo).toBeInstanceOf(Date);
      expect(delayResult.delayedTo!.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('fromProtoBatchResponse', () => {
    it('handles mixed success/failure results', () => {
      const response = new kubemq.QueueMessagesBatchResponse({
        BatchID: 'batch-1',
        Results: [
          new kubemq.SendQueueMessageResult({
            IsError: false,
            MessageID: 'ok-1',
            SentAt: 100,
          }),
          new kubemq.SendQueueMessageResult({
            IsError: true,
            Error: 'item failed',
            MessageID: '',
          }),
          new kubemq.SendQueueMessageResult({
            IsError: false,
            MessageID: 'ok-2',
            SentAt: 200,
          }),
        ],
      });
      const result = fromProtoBatchResponse(response);

      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(1);
      expect(result.results).toHaveLength(3);
      expect(result.results[0]!.messageId).toBe('ok-1');
      expect(result.results[0]!.error).toBeUndefined();
      expect(result.results[1]!.error).toBeInstanceOf(KubeMQError);
      expect(result.results[1]!.messageId).toBeUndefined();
      expect(result.results[2]!.messageId).toBe('ok-2');
    });

    it('handles empty results array', () => {
      const response = new kubemq.QueueMessagesBatchResponse({
        BatchID: 'batch-empty',
        Results: [],
      });
      const result = fromProtoBatchResponse(response);

      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(0);
      expect(result.results).toHaveLength(0);
    });

    it('handles all-failure batch', () => {
      const response = new kubemq.QueueMessagesBatchResponse({
        BatchID: 'batch-fail',
        Results: [
          new kubemq.SendQueueMessageResult({ IsError: true, Error: 'err-1' }),
          new kubemq.SendQueueMessageResult({ IsError: true, Error: 'err-2' }),
        ],
      });
      const result = fromProtoBatchResponse(response);

      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(2);
    });
  });

  describe('fromProtoReceivedQueueMessage', () => {
    it('converts QueueMessage with attributes using nanosecond timestamps', () => {
      const nowMs = Date.now();
      const tsNs = BigInt(nowMs) * BigInt(1_000_000);
      const expirationNs = BigInt(nowMs + 60_000) * BigInt(1_000_000);
      const delayedNs = BigInt(nowMs + 5_000) * BigInt(1_000_000);
      const msg = new kubemq.QueueMessage({
        MessageID: 'qmsg-1',
        Channel: 'queue.rx',
        ClientID: 'sender-q',
        Body: encoder.encode('queue-body'),
        Metadata: 'q-rx-meta',
        Tags: new Map([['prio', 'low']]),
        Attributes: new kubemq.QueueMessageAttributes({
          Timestamp: Number(tsNs),
          Sequence: 7,
          ReceiveCount: 2,
          ReRouted: true,
          ReRoutedFromQueue: 'original-queue',
          ExpirationAt: Number(expirationNs),
          DelayedTo: Number(delayedNs),
        }),
      });
      const out = fromProtoReceivedQueueMessage(msg);

      expect(out.id).toBe('qmsg-1');
      expect(out.channel).toBe('queue.rx');
      expect(out.fromClientId).toBe('sender-q');
      expect(out.body).toEqual(encoder.encode('queue-body'));
      expect(out.metadata).toBe('q-rx-meta');
      expect(out.tags).toEqual({ prio: 'low' });
      expect(out.sequence).toBe(7);
      expect(out.receiveCount).toBe(2);
      expect(out.isReRouted).toBe(true);
      expect(out.reRouteFromQueue).toBe('original-queue');
      expect(out.expiredAt).toBeInstanceOf(Date);
      expect(out.delayedTo).toBeInstanceOf(Date);
      // Verify nanosecond→millisecond conversion produces correct dates
      expect(Math.abs(out.timestamp.getTime() - nowMs)).toBeLessThan(10);
      expect(Math.abs(out.expiredAt!.getTime() - (nowMs + 60_000))).toBeLessThan(10);
      expect(Math.abs(out.delayedTo!.getTime() - (nowMs + 5_000))).toBeLessThan(10);
    });

    it('expiredAt and delayedTo are undefined when attributes have zero values', () => {
      const tsNs = BigInt(Date.now()) * BigInt(1_000_000);
      const msg = new kubemq.QueueMessage({
        MessageID: 'qmsg-nots',
        Channel: 'queue.rx',
        ClientID: 'sender-q',
        Attributes: new kubemq.QueueMessageAttributes({
          Timestamp: Number(tsNs),
          Sequence: 1,
          ReceiveCount: 1,
          ExpirationAt: 0,
          DelayedTo: 0,
        }),
      });
      const out = fromProtoReceivedQueueMessage(msg);

      expect(out.expiredAt).toBeUndefined();
      expect(out.delayedTo).toBeUndefined();
    });

    it('handles message without attributes', () => {
      const msg = new kubemq.QueueMessage({
        MessageID: 'qmsg-noattr',
        Channel: 'queue.simple',
        ClientID: 'sender',
      });
      const out = fromProtoReceivedQueueMessage(msg);

      expect(out.sequence).toBe(0);
      expect(out.receiveCount).toBe(0);
      expect(out.isReRouted).toBe(false);
      expect(out.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('fromProtoReceiveQueueResponse', () => {
    it('throws KubeMQError on IsError=true', () => {
      const response = new kubemq.ReceiveQueueMessagesResponse({
        IsError: true,
        Error: 'receive timeout',
      });

      expect(() => fromProtoReceiveQueueResponse(response, 'receiveQueueMessages')).toThrow(
        KubeMQError,
      );
      expect(() => fromProtoReceiveQueueResponse(response, 'receiveQueueMessages')).toThrow(
        'receive timeout',
      );
    });

    it('returns mapped messages on success', () => {
      const response = new kubemq.ReceiveQueueMessagesResponse({
        IsError: false,
        Messages: [
          new kubemq.QueueMessage({
            MessageID: 'rx-1',
            Channel: 'q-ch',
            ClientID: 'c1',
          }),
          new kubemq.QueueMessage({
            MessageID: 'rx-2',
            Channel: 'q-ch',
            ClientID: 'c2',
          }),
        ],
      });
      const messages = fromProtoReceiveQueueResponse(response, 'receiveQueueMessages');

      expect(messages).toHaveLength(2);
      expect(messages[0]!.id).toBe('rx-1');
      expect(messages[1]!.id).toBe('rx-2');
    });

    it('returns empty array when no messages', () => {
      const response = new kubemq.ReceiveQueueMessagesResponse({
        IsError: false,
        Messages: [],
      });
      const messages = fromProtoReceiveQueueResponse(response, 'receiveQueueMessages');

      expect(messages).toHaveLength(0);
    });
  });

  // ─── fromTagsMap helper ─────────────────────────────────────────

  describe('fromTagsMap', () => {
    it('converts Map to Record', () => {
      const map = new Map([
        ['a', '1'],
        ['b', '2'],
      ]);
      expect(fromTagsMap(map)).toEqual({ a: '1', b: '2' });
    });

    it('returns shallow copy for plain object', () => {
      const obj = { x: 'y' };
      const result = fromTagsMap(obj);
      expect(result).toEqual({ x: 'y' });
      expect(result).not.toBe(obj);
    });

    it('returns empty object for undefined', () => {
      expect(fromTagsMap(undefined)).toEqual({});
    });

    it('returns empty object for null', () => {
      expect(fromTagsMap(null)).toEqual({});
    });
  });

  describe('fromProtoQueryResponse — cacheHit (GAP-08)', () => {
    it('maps CacheHit true from proto', () => {
      const proto = new kubemq.Response({
        RequestID: 'q-1',
        ReplyChannel: 'reply-ch',
        ClientID: CLIENT_ID,
        Executed: true,
        CacheHit: true,
      });
      const resp = fromProtoQueryResponse(proto);
      expect(resp.cacheHit).toBe(true);
    });

    it('maps CacheHit false from proto', () => {
      const proto = new kubemq.Response({
        RequestID: 'q-2',
        ReplyChannel: 'reply-ch',
        Executed: true,
        CacheHit: false,
      });
      const resp = fromProtoQueryResponse(proto);
      expect(resp.cacheHit).toBe(false);
    });
  });

  describe('fromProtoCommandResponse — metadata/body (GAP-17)', () => {
    it('maps metadata and body from proto', () => {
      const body = new TextEncoder().encode('cmd-body');
      const proto = new kubemq.Response({
        RequestID: 'c-1',
        ReplyChannel: 'reply-ch',
        Executed: true,
        Metadata: 'cmd-meta',
        Body: body,
      });
      const resp = fromProtoCommandResponse(proto);
      expect(resp.metadata).toBe('cmd-meta');
      expect(resp.body).toEqual(body);
    });

    it('metadata and body are undefined when empty', () => {
      const proto = new kubemq.Response({
        RequestID: 'c-2',
        ReplyChannel: 'reply-ch',
        Executed: true,
      });
      const resp = fromProtoCommandResponse(proto);
      expect(resp.metadata).toBeUndefined();
      expect(resp.body).toBeUndefined();
    });
  });

  describe('toProtoRequest — span field (GAP-22)', () => {
    it('sets Span on proto when span provided', () => {
      const span = new Uint8Array([1, 2, 3]);
      const msg = {
        channel: 'cmd.ch',
        body: encoder.encode('hello'),
        timeoutMs: 5000,
        span,
      };
      const proto = toProtoRequest(msg as any, CLIENT_ID);
      expect(proto.Span).toEqual(span);
    });

    it('does not set Span when not provided', () => {
      const msg = {
        channel: 'cmd.ch',
        body: encoder.encode('hello'),
        timeoutMs: 5000,
      };
      const proto = toProtoRequest(msg as any, CLIENT_ID);
      expect(proto.Span?.length ?? 0).toBe(0);
    });
  });

  describe('toProtoResponse — span field (GAP-22)', () => {
    it('sets Span on proto response when span provided', () => {
      const span = new Uint8Array([4, 5, 6]);
      const resp = {
        id: 'r-1',
        replyChannel: 'reply',
        executed: true,
        span,
      };
      const proto = toProtoResponse(resp as any, CLIENT_ID);
      expect(proto.Span).toEqual(span);
    });
  });

  describe('toProtoQueuesUpstreamRequest (GAP-01)', () => {
    it('wraps messages in upstream request', () => {
      const msgs = [{ channel: 'q-ch', body: encoder.encode('msg1'), metadata: 'meta' }];
      const proto = toProtoQueuesUpstreamRequest(msgs, CLIENT_ID);
      expect(proto.RequestID).toBeDefined();
      expect(proto.Messages).toHaveLength(1);
      expect(proto.Messages[0].Channel).toBe('q-ch');
    });
  });

  describe('fromProtoQueuesUpstreamResponse (GAP-01)', () => {
    it('maps upstream response with nanosecond timestamps', () => {
      const nowMs = Date.now();
      const sentAtNs = nowMs * 1e6;
      const proto = new kubemq.QueuesUpstreamResponse({
        RefRequestID: 'up-1',
        Results: [
          new kubemq.SendQueueMessageResult({
            MessageID: 'm-1',
            SentAt: sentAtNs,
            IsError: false,
          }),
        ],
        IsError: false,
      });
      const result = fromProtoQueuesUpstreamResponse(proto, 'test');
      expect(result.isError).toBe(false);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].messageId).toBe('m-1');
      expect(result.results[0].sentAt).toBeInstanceOf(Date);
      // Verify nanosecond→millisecond conversion
      expect(Math.abs(result.results[0].sentAt.getTime() - nowMs)).toBeLessThan(10);
    });

    it('correctly converts all timestamp fields from nanoseconds', () => {
      const nowMs = Date.now();
      const sentAtNs = nowMs * 1e6;
      const expirationNs = (nowMs + 30_000) * 1e6;
      const delayedNs = (nowMs + 10_000) * 1e6;
      const proto = new kubemq.QueuesUpstreamResponse({
        RefRequestID: 'up-2',
        Results: [
          new kubemq.SendQueueMessageResult({
            MessageID: 'm-2',
            SentAt: sentAtNs,
            ExpirationAt: expirationNs,
            DelayedTo: delayedNs,
            IsError: false,
          }),
        ],
        IsError: false,
      });
      const result = fromProtoQueuesUpstreamResponse(proto, 'test');
      const r = result.results[0];
      expect(Math.abs(r.sentAt.getTime() - nowMs)).toBeLessThan(10);
      expect(Math.abs(r.expirationAt!.getTime() - (nowMs + 30_000))).toBeLessThan(10);
      expect(Math.abs(r.delayedTo!.getTime() - (nowMs + 10_000))).toBeLessThan(10);
    });

    it('returns undefined for optional dates when zero in upstream response', () => {
      const nowNs = Date.now() * 1e6;
      const proto = new kubemq.QueuesUpstreamResponse({
        RefRequestID: 'up-3',
        Results: [
          new kubemq.SendQueueMessageResult({
            MessageID: 'm-3',
            SentAt: nowNs,
            ExpirationAt: 0,
            DelayedTo: 0,
            IsError: false,
          }),
        ],
        IsError: false,
      });
      const result = fromProtoQueuesUpstreamResponse(proto, 'test');
      expect(result.results[0].expirationAt).toBeUndefined();
      expect(result.results[0].delayedTo).toBeUndefined();
    });
  });
});
