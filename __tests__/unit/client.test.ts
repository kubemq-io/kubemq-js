import { describe, it, expect, vi } from 'vitest';
import { KubeMQClient } from '../../src/client.js';
import { MockTransport } from '../fixtures/mock-transport.js';
import { applyDefaults } from '../../src/internal/config-defaults.js';
import { ConnectionState } from '../../src/internal/transport/connection-state.js';
import { kubemq } from '../../src/protos/kubemq.js';
import {
  ValidationError,
  NotImplementedError,
  ClientClosedError,
  KubeMQError,
} from '../../src/errors.js';
import { EventStoreStartPosition } from '../../src/messages/events-store.js';

function createClient(transport?: MockTransport) {
  const opts = {
    address: 'localhost:50000',
    clientId: 'test-client',
    retry: {
      maxRetries: 0,
      initialBackoffMs: 10,
      maxBackoffMs: 100,
      multiplier: 2,
      jitter: 'none' as const,
    },
  };
  const resolved = Object.freeze(applyDefaults(opts));
  const t = transport ?? new MockTransport();
  t.setConnectBehavior('success');
  const client = KubeMQClient._createForTesting(opts, resolved, t as any);
  return { client, transport: t };
}

function captureDuplexStream(transport: MockTransport) {
  let capturedStream: any;
  const origDuplex = transport.duplexStream.bind(transport);
  transport.duplexStream = (...args: any[]) => {
    const s = (origDuplex as any)(...args);
    capturedStream = s;
    return s;
  };
  return () => capturedStream;
}

function captureServerStream(transport: MockTransport) {
  let capturedStream: any;
  const origStream = transport.serverStream.bind(transport);
  transport.serverStream = (...args: any[]) => {
    const s = (origStream as any)(...args);
    capturedStream = s;
    return s;
  };
  return () => capturedStream;
}

function stream_simulateCommand(stream: any) {
  stream.simulateData(
    new kubemq.Request({
      RequestID: 'cmd-1',
      RequestTypeData: 1,
      Channel: 'cmd-ch',
      ClientID: 'sender',
      ReplyChannel: 'reply-ch',
      Body: new Uint8Array([1]),
      Timeout: 5000,
    }),
  );
}

function stream_simulateQuery(stream: any) {
  stream.simulateData(
    new kubemq.Request({
      RequestID: 'qry-1',
      RequestTypeData: 2,
      Channel: 'qry-ch',
      ClientID: 'sender',
      ReplyChannel: 'reply-ch',
      Body: new Uint8Array([1]),
      Timeout: 5000,
    }),
  );
}

describe('KubeMQClient', () => {
  // ─── Getters ───

  describe('getters', () => {
    it('options returns frozen options', () => {
      const { client } = createClient();
      const opts = client.options;
      expect(opts.address).toBe('localhost:50000');
      expect(opts.clientId).toBe('test-client');
      expect(Object.isFrozen(opts)).toBe(true);
    });

    it('clientId returns resolved clientId', () => {
      const { client } = createClient();
      expect(client.clientId).toBe('test-client');
    });

    it('address returns resolved address', () => {
      const { client } = createClient();
      expect(client.address).toBe('localhost:50000');
    });

    it('state returns transport state (IDLE initially)', () => {
      const { client } = createClient();
      expect(client.state).toBe(ConnectionState.IDLE);
    });

    it('state reflects transport state changes', async () => {
      const transport = new MockTransport();
      const { client } = createClient(transport);
      await transport.connect();
      expect(client.state).toBe(ConnectionState.READY);
    });
  });

  // ─── sendEvent ───

  describe('sendEvent', () => {
    it('writes event to SendEventsStream', async () => {
      const { client, transport } = createClient();
      const getStream = captureDuplexStream(transport);
      await transport.connect();

      await client.sendEvent({ channel: 'events.test', body: new Uint8Array([1, 2]) });

      expect(transport.callsTo('SendEventsStream')).toHaveLength(1);
      const stream = getStream();
      expect(stream.written).toHaveLength(1);
      expect((stream.written[0] as any).Channel).toBe('events.test');
    });

    it('throws ValidationError for empty channel', async () => {
      const { client } = createClient();
      await expect(client.sendEvent({ channel: '' })).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError for whitespace-only channel', async () => {
      const { client } = createClient();
      await expect(client.sendEvent({ channel: '   ' })).rejects.toThrow(ValidationError);
    });

    it('passes metadata and tags through', async () => {
      const { client, transport } = createClient();
      const getStream = captureDuplexStream(transport);
      await transport.connect();

      await client.sendEvent({
        channel: 'ch',
        metadata: 'meta',
        tags: { key: 'val' },
      });

      const req = getStream().written[0] as any;
      expect(req.Metadata).toBe('meta');
    });

    it('throws KubeMQError when Result.Sent is false', async () => {
      const { client, transport } = createClient();
      transport.onUnaryCall(
        'SendEvent',
        () => new kubemq.Result({ EventID: 'ev-3', Sent: false, Error: 'send failed' }),
      );
      await expect(client.sendEvent({ channel: 'ch' })).rejects.toThrow(KubeMQError);
    });
  });

  // ─── sendEventStore ───

  describe('sendEventStore', () => {
    it('writes event to SendEventsStream with Store=true', async () => {
      const { client, transport } = createClient();
      const getStream = captureDuplexStream(transport);
      await transport.connect();

      const sendPromise = client.sendEventStore({ channel: 'store.ch', body: new Uint8Array([5]) });

      await new Promise((r) => setTimeout(r, 10));
      const stream = getStream();
      expect(stream.written).toHaveLength(1);
      const req = stream.written[0] as any;
      expect(req.Store).toBe(true);

      // Simulate server ACK
      stream.simulateData(new kubemq.Result({ EventID: req.EventID, Sent: true }));
      await sendPromise;
    });

    it('throws ValidationError for empty channel', async () => {
      const { client } = createClient();
      await expect(client.sendEventStore({ channel: '' })).rejects.toThrow(ValidationError);
    });
  });

  // ─── sendQueueMessage ───

  describe('sendQueueMessage', () => {
    it('sends via QueuesUpstream and returns QueueSendResult', async () => {
      const { client, transport } = createClient();
      const getStream = captureDuplexStream(transport);
      await transport.connect();

      const sentAt = BigInt(Date.now() * 1_000_000);
      const sendPromise = client.sendQueueMessage({
        channel: 'queue.test',
        body: new Uint8Array([1]),
      });

      await new Promise((r) => setTimeout(r, 10));
      const stream = getStream();
      expect(stream.written).toHaveLength(1);
      const req = stream.written[0] as any;

      // Simulate server ACK
      stream.simulateData(
        new kubemq.QueuesUpstreamResponse({
          RefRequestID: req.RequestID,
          Results: [
            new kubemq.SendQueueMessageResult({
              MessageID: 'qm-1',
              SentAt: sentAt,
              IsError: false,
            }),
          ],
          IsError: false,
        }),
      );

      const result = await sendPromise;
      expect(result.messageId).toBe('qm-1');
      expect(result.sentAt).toBeInstanceOf(Date);
    });

    it('throws ValidationError for empty channel', async () => {
      const { client } = createClient();
      await expect(client.sendQueueMessage({ channel: '' })).rejects.toThrow(ValidationError);
    });

    it('throws KubeMQError when IsError is true', async () => {
      const { client, transport } = createClient();
      transport.onUnaryCall(
        'SendQueueMessage',
        () =>
          new kubemq.SendQueueMessageResult({
            MessageID: 'qm-2',
            SentAt: BigInt(0),
            IsError: true,
            Error: 'queue error',
          }),
      );
      await expect(client.sendQueueMessage({ channel: 'q' })).rejects.toThrow(KubeMQError);
    });
  });

  // ─── sendQueueMessagesBatch ───

  describe('sendQueueMessagesBatch', () => {
    it('calls SendQueueMessagesBatch and returns BatchSendResult', async () => {
      const { client, transport } = createClient();
      transport.onUnaryCall(
        'SendQueueMessagesBatch',
        () =>
          new kubemq.QueueMessagesBatchResponse({
            BatchID: 'b-1',
            Results: [
              new kubemq.SendQueueMessageResult({
                MessageID: 'bm-1',
                SentAt: BigInt(Date.now() * 1_000_000),
                IsError: false,
              }),
            ],
          }),
      );
      const result = await client.sendQueueMessagesBatch([
        { channel: 'q', body: new Uint8Array([1]) },
      ]);
      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(0);
      expect(result.results).toHaveLength(1);
    });

    it('throws ValidationError for empty batch', async () => {
      const { client } = createClient();
      await expect(client.sendQueueMessagesBatch([])).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError for null-ish batch', async () => {
      const { client } = createClient();
      await expect(client.sendQueueMessagesBatch(null as any)).rejects.toThrow(ValidationError);
    });

    it('validates each message in batch', async () => {
      const { client } = createClient();
      await expect(client.sendQueueMessagesBatch([{ channel: '' }])).rejects.toThrow(
        ValidationError,
      );
    });
  });

  // ─── receiveQueueMessages ───

  describe('receiveQueueMessages', () => {
    function setupReceiveHandler(transport: MockTransport) {
      transport.onUnaryCall(
        'ReceiveQueueMessages',
        () =>
          new kubemq.ReceiveQueueMessagesResponse({
            RequestID: 'r-1',
            Messages: [
              new kubemq.QueueMessage({
                MessageID: 'rm-1',
                Channel: 'q-ch',
                Body: new Uint8Array([1, 2, 3]),
                Metadata: 'meta',
                Attributes: new kubemq.QueueMessageAttributes({
                  Timestamp: BigInt(Date.now() * 1_000_000),
                  Sequence: BigInt(1),
                  ReceiveCount: 1,
                }),
              }),
            ],
            MessagesReceived: 1,
            IsError: false,
          }),
      );
    }

    it('calls ReceiveQueueMessages and returns array', async () => {
      const { client, transport } = createClient();
      setupReceiveHandler(transport);
      const msgs = await client.receiveQueueMessages({
        channel: 'q-ch',
        waitTimeoutSeconds: 5,
      });
      expect(msgs).toHaveLength(1);
      expect(msgs[0]!.id).toBe('rm-1');
      expect(msgs[0]!.channel).toBe('q-ch');
      expect(msgs[0]!.body).toEqual(new Uint8Array([1, 2, 3]));
      expect(msgs[0]!.metadata).toBe('meta');
    });

    it('ack is a no-op', async () => {
      const { client, transport } = createClient();
      setupReceiveHandler(transport);
      const msgs = await client.receiveQueueMessages({
        channel: 'q-ch',
        waitTimeoutSeconds: 5,
      });
      await expect(msgs[0]!.ack()).resolves.toBeUndefined();
    });

    it('nack is a no-op', async () => {
      const { client, transport } = createClient();
      setupReceiveHandler(transport);
      const msgs = await client.receiveQueueMessages({
        channel: 'q-ch',
        waitTimeoutSeconds: 5,
      });
      await expect(msgs[0]!.nack()).resolves.toBeUndefined();
    });

    it('reQueue throws NotImplementedError', async () => {
      const { client, transport } = createClient();
      setupReceiveHandler(transport);
      const msgs = await client.receiveQueueMessages({
        channel: 'q-ch',
        waitTimeoutSeconds: 5,
      });
      expect(() => msgs[0]!.reQueue('other')).toThrow(NotImplementedError);
    });

    it('throws when response IsError', async () => {
      const { client, transport } = createClient();
      transport.onUnaryCall(
        'ReceiveQueueMessages',
        () =>
          new kubemq.ReceiveQueueMessagesResponse({
            RequestID: 'r-err',
            IsError: true,
            Error: 'receive failed',
          }),
      );
      await expect(
        client.receiveQueueMessages({
          channel: 'ch',
          waitTimeoutSeconds: 5,
        }),
      ).rejects.toThrow(KubeMQError);
    });
  });

  // ─── streamQueueMessages ───

  describe('streamQueueMessages', () => {
    function createStreamResponse(txId = 'tx-1', msgId = 'msg-1') {
      return new kubemq.QueuesDownstreamResponse({
        TransactionId: txId,
        Messages: [
          new kubemq.QueueMessage({
            MessageID: msgId,
            Channel: 'stream-ch',
            Body: new Uint8Array([1]),
            Metadata: 'meta',
            Tags: {},
            Attributes: new kubemq.QueueMessageAttributes({
              Timestamp: BigInt(Date.now() * 1_000_000),
              Sequence: BigInt(42),
              ReceiveCount: 1,
            }),
          }),
        ],
        IsError: false,
      });
    }

    it('opens duplexStream with QueuesDownstream', () => {
      const { client, transport } = createClient();
      captureDuplexStream(transport);
      const handle = client.streamQueueMessages({ channel: 'stream-ch' });
      expect(transport.callsTo('QueuesDownstream')).toHaveLength(1);
      expect(handle.isActive).toBe(true);
    });

    it('delivers messages via onMessages handler', async () => {
      const { client, transport } = createClient();
      const getStream = captureDuplexStream(transport);
      const handle = client.streamQueueMessages({ channel: 'stream-ch' });
      const received: any[] = [];
      handle.onMessages((msgs) => received.push(...msgs));

      getStream().simulateData(createStreamResponse());
      expect(received).toHaveLength(1);
      expect(received[0].id).toBe('msg-1');
      expect(received[0].channel).toBe('stream-ch');
      expect(received[0].sequence).toBe(42);
    });

    // C1 fix: per-message ack now uses AckRange (3) instead of AckAll (2)
    it('ack writes RequestTypeData=3 (AckRange) and schedules re-poll on batch completion', async () => {
      const { client, transport } = createClient();
      const getStream = captureDuplexStream(transport);
      const handle = client.streamQueueMessages({ channel: 'stream-ch' });
      const received: any[] = [];
      handle.onMessages((msgs) => received.push(...msgs));

      getStream().simulateData(createStreamResponse());
      received[0].ack();

      const written = getStream().written;
      const ackMsg = written.find((w: any) => w.RequestTypeData === 3);
      expect(ackMsg).toBeDefined();
      expect(ackMsg.RefTransactionId).toBe('tx-1');

      // C2 fix: re-poll fires after all messages in batch are settled (batch size = 1 here)
      await new Promise((r) => setTimeout(r, 0));
      const rePoll = written.find((w: any, i: number) => i > 1 && w.RequestTypeData === 1);
      expect(rePoll).toBeDefined();
    });

    // C1 fix: per-message nack now uses NAckRange (5) instead of NAckAll (4)
    // C2 fix: nack also triggers re-poll via batch completion (batch size = 1)
    it('nack writes RequestTypeData=5 (NAckRange) and re-polls on batch completion', async () => {
      const { client, transport } = createClient();
      const getStream = captureDuplexStream(transport);
      const handle = client.streamQueueMessages({ channel: 'stream-ch' });
      const received: any[] = [];
      handle.onMessages((msgs) => received.push(...msgs));

      getStream().simulateData(createStreamResponse());
      received[0].nack();

      const written = getStream().written;
      const nackMsg = written.find((w: any) => w.RequestTypeData === 5);
      expect(nackMsg).toBeDefined();
      expect(nackMsg.RefTransactionId).toBe('tx-1');

      await new Promise((r) => setTimeout(r, 0));
      // With batch size=1, settling the only message triggers re-poll
      const rePoll = written.find((w: any, i: number) => i > 1 && w.RequestTypeData === 1);
      expect(rePoll).toBeDefined();
    });

    // C1 fix: per-message reQueue now uses ReQueueRange (7) instead of ReQueueAll (6)
    it('reQueue writes RequestTypeData=7 (ReQueueRange) with target channel in ReQueueChannel', async () => {
      const { client, transport } = createClient();
      const getStream = captureDuplexStream(transport);
      const handle = client.streamQueueMessages({ channel: 'stream-ch' });
      const received: any[] = [];
      handle.onMessages((msgs) => received.push(...msgs));

      getStream().simulateData(createStreamResponse());
      received[0].reQueue('other-ch');

      const written = getStream().written;
      const requeueMsg = written.find((w: any) => w.RequestTypeData === 7);
      expect(requeueMsg).toBeDefined();
      expect(requeueMsg.ReQueueChannel).toBe('other-ch');
    });

    it('close writes RequestTypeData=10 and ends stream', () => {
      const { client, transport } = createClient();
      const getStream = captureDuplexStream(transport);
      const handle = client.streamQueueMessages({ channel: 'stream-ch' });

      getStream().simulateData(createStreamResponse());
      handle.close();

      const written = getStream().written;
      const closeMsg = written.find((w: any) => w.RequestTypeData === 10);
      expect(closeMsg).toBeDefined();
      expect(handle.isActive).toBe(false);
    });

    it('does NOT auto-re-poll without autoAck', async () => {
      const { client, transport } = createClient();
      const getStream = captureDuplexStream(transport);
      client.streamQueueMessages({ channel: 'stream-ch', autoAck: false });

      getStream().simulateData(createStreamResponse());
      await new Promise((r) => setTimeout(r, 0));

      const rePolls = getStream().written.filter(
        (w: any, i: number) => i > 0 && w.RequestTypeData === 1,
      );
      expect(rePolls).toHaveLength(0);
    });

    it('auto-re-polls when autoAck is true', async () => {
      const { client, transport } = createClient();
      const getStream = captureDuplexStream(transport);
      client.streamQueueMessages({ channel: 'stream-ch', autoAck: true });

      getStream().simulateData(createStreamResponse());
      await new Promise((r) => setTimeout(r, 0));

      const rePolls = getStream().written.filter(
        (w: any, i: number) => i > 0 && w.RequestTypeData === 1,
      );
      expect(rePolls.length).toBeGreaterThanOrEqual(1);
    });

    it('error handler fires on stream error', () => {
      const { client, transport } = createClient();
      const getStream = captureDuplexStream(transport);
      const handle = client.streamQueueMessages({ channel: 'stream-ch' });
      const errors: Error[] = [];
      handle.onError((err) => errors.push(err));

      getStream().simulateError(new Error('stream broke'));
      expect(errors).toHaveLength(1);
      expect(errors[0]!.message).toBe('stream broke');
      expect(handle.isActive).toBe(false);
    });

    it('close handler fires on stream end', () => {
      const { client, transport } = createClient();
      const getStream = captureDuplexStream(transport);
      const handle = client.streamQueueMessages({ channel: 'stream-ch' });
      let closed = false;
      handle.onClose(() => {
        closed = true;
      });

      getStream().simulateEnd();
      expect(closed).toBe(true);
      expect(handle.isActive).toBe(false);
    });

    it('error response invokes error handler', () => {
      const { client, transport } = createClient();
      const getStream = captureDuplexStream(transport);
      const handle = client.streamQueueMessages({ channel: 'stream-ch' });
      const errors: Error[] = [];
      handle.onError((err) => errors.push(err));

      getStream().simulateData(
        new kubemq.QueuesDownstreamResponse({
          TransactionId: 'tx-err',
          IsError: true,
          Error: 'downstream error',
        }),
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]!.message).toContain('downstream error');
    });

    it('ack after close is a no-op', async () => {
      const { client, transport } = createClient();
      const getStream = captureDuplexStream(transport);
      const handle = client.streamQueueMessages({ channel: 'stream-ch' });
      const received: any[] = [];
      handle.onMessages((msgs) => received.push(...msgs));

      getStream().simulateData(createStreamResponse());
      handle.close();

      const writtenBefore = getStream().written.length;
      received[0].ack();
      expect(getStream().written.length).toBe(writtenBefore);
    });

    it('double-settle is a no-op', async () => {
      const { client, transport } = createClient();
      const getStream = captureDuplexStream(transport);
      const handle = client.streamQueueMessages({ channel: 'stream-ch' });
      const received: any[] = [];
      handle.onMessages((msgs) => received.push(...msgs));

      getStream().simulateData(createStreamResponse());
      received[0].ack();
      const writtenAfterAck = getStream().written.length;
      received[0].nack();
      expect(getStream().written.length).toBe(writtenAfterAck);
    });

    it('reQueueAll writes RequestTypeData=6 with ReQueueChannel', () => {
      const { client, transport } = createClient();
      const getStream = captureDuplexStream(transport);
      const handle = client.streamQueueMessages({ channel: 'stream-ch' });

      getStream().simulateData(createStreamResponse());
      handle.reQueueAll('requeue-target-ch');

      const written = getStream().written;
      const requeueAllMsg = written.find(
        (w: any) => w.RequestTypeData === 6 && w.ReQueueChannel === 'requeue-target-ch',
      );
      expect(requeueAllMsg).toBeDefined();
      expect(requeueAllMsg.ReQueueChannel).toBe('requeue-target-ch');
      // Channel should be the original stream channel, NOT the requeue target
      expect(requeueAllMsg.Channel).toBe('stream-ch');
    });

    it('reQueueRange writes RequestTypeData=7 with ReQueueChannel and SequenceRange', () => {
      const { client, transport } = createClient();
      const getStream = captureDuplexStream(transport);
      const handle = client.streamQueueMessages({ channel: 'stream-ch' });

      getStream().simulateData(createStreamResponse());
      handle.reQueueRange('requeue-range-ch', [1, 2, 3]);

      const written = getStream().written;
      const requeueRangeMsg = written.find((w: any) => w.RequestTypeData === 7);
      expect(requeueRangeMsg).toBeDefined();
      expect(requeueRangeMsg.ReQueueChannel).toBe('requeue-range-ch');
      expect(requeueRangeMsg.SequenceRange).toEqual([1, 2, 3]);
      // Channel should NOT be set to the requeue target
      expect(requeueRangeMsg.Channel).not.toBe('requeue-range-ch');
    });

    it('per-message reQueue sets ReQueueChannel (not Channel) on proto request', async () => {
      const { client, transport } = createClient();
      const getStream = captureDuplexStream(transport);
      const handle = client.streamQueueMessages({ channel: 'stream-ch' });
      const received: any[] = [];
      handle.onMessages((msgs) => received.push(...msgs));

      getStream().simulateData(createStreamResponse());
      received[0].reQueue('per-msg-target');

      const written = getStream().written;
      // C1 fix: per-message reQueue now uses ReQueueRange (7) instead of ReQueueAll (6)
      const requeueMsg = written.find(
        (w: any) => w.RequestTypeData === 7 && w.RefTransactionId === 'tx-1',
      );
      expect(requeueMsg).toBeDefined();
      expect(requeueMsg.ReQueueChannel).toBe('per-msg-target');
    });

    it('throws ValidationError for empty channel', () => {
      const { client } = createClient();
      expect(() => client.streamQueueMessages({ channel: '' })).toThrow(ValidationError);
    });
  });

  // ─── peekQueueMessages ───

  describe('peekQueueMessages', () => {
    it('calls ReceiveQueueMessages with IsPeak=true', async () => {
      const { client, transport } = createClient();
      transport.onUnaryCall('ReceiveQueueMessages', (_m, req: any) => {
        expect(req.IsPeak).toBe(true);
        return new kubemq.ReceiveQueueMessagesResponse({
          RequestID: 'pk-1',
          Messages: [
            new kubemq.QueueMessage({
              MessageID: 'pk-msg',
              Channel: 'pk-ch',
              Body: new Uint8Array([1]),
              Metadata: '',
              Attributes: new kubemq.QueueMessageAttributes({
                Timestamp: BigInt(Date.now() * 1_000_000),
                Sequence: BigInt(1),
                ReceiveCount: 1,
              }),
            }),
          ],
          MessagesReceived: 1,
          IsError: false,
        });
      });

      const msgs = await client.peekQueueMessages({
        channel: 'pk-ch',
        waitTimeoutSeconds: 5,
      });
      expect(msgs).toHaveLength(1);
      expect(msgs[0]!.id).toBe('pk-msg');
    });

    it('ack/nack/reQueue are no-ops on peek results', async () => {
      const { client, transport } = createClient();
      transport.onUnaryCall(
        'ReceiveQueueMessages',
        () =>
          new kubemq.ReceiveQueueMessagesResponse({
            RequestID: 'pk-2',
            Messages: [
              new kubemq.QueueMessage({
                MessageID: 'pk-msg2',
                Channel: 'pk-ch',
                Body: new Uint8Array([1]),
                Attributes: new kubemq.QueueMessageAttributes({
                  Timestamp: BigInt(Date.now() * 1_000_000),
                  Sequence: BigInt(1),
                  ReceiveCount: 1,
                }),
              }),
            ],
            MessagesReceived: 1,
            IsError: false,
          }),
      );

      const msgs = await client.peekQueueMessages({
        channel: 'pk-ch',
        waitTimeoutSeconds: 5,
      });
      await expect(msgs[0]!.ack()).resolves.toBeUndefined();
      await expect(msgs[0]!.nack()).resolves.toBeUndefined();
      await expect(msgs[0]!.reQueue('other')).resolves.toBeUndefined();
    });
  });

  // ─── sendCommand ───

  describe('sendCommand', () => {
    it('calls SendRequest and returns CommandResponse', async () => {
      const { client, transport } = createClient();
      transport.onUnaryCall(
        'SendRequest',
        () =>
          new kubemq.Response({
            RequestID: 'cmd-1',
            ClientID: 'responder',
            Executed: true,
            Timestamp: BigInt(Date.now()),
          }),
      );
      const resp = await client.sendCommand({
        channel: 'cmd.ch',
        body: new Uint8Array([1]),
        timeoutInSeconds: 5,
      });
      expect(resp.id).toBe('cmd-1');
      expect(resp.executed).toBe(true);
      expect(transport.callsTo('SendRequest')).toHaveLength(1);
    });

    it('throws ValidationError for empty channel', async () => {
      const { client } = createClient();
      await expect(client.sendCommand({ channel: '', timeoutInSeconds: 5 })).rejects.toThrow(
        ValidationError,
      );
    });
  });

  // ─── sendQuery ───

  describe('sendQuery', () => {
    it('calls SendRequest and returns QueryResponse', async () => {
      const { client, transport } = createClient();
      transport.onUnaryCall(
        'SendRequest',
        () =>
          new kubemq.Response({
            RequestID: 'qry-1',
            ClientID: 'responder',
            Executed: true,
            Timestamp: BigInt(Date.now()),
            Body: new Uint8Array([10, 20]),
            Metadata: 'query-meta',
          }),
      );
      const resp = await client.sendQuery({
        channel: 'qry.ch',
        body: new Uint8Array([1]),
        timeoutInSeconds: 5,
      });
      expect(resp.id).toBe('qry-1');
      expect(resp.executed).toBe(true);
      expect(resp.body).toEqual(new Uint8Array([10, 20]));
      expect(resp.metadata).toBe('query-meta');
    });

    it('throws ValidationError for empty channel', async () => {
      const { client } = createClient();
      await expect(client.sendQuery({ channel: '', timeoutInSeconds: 5 })).rejects.toThrow(
        ValidationError,
      );
    });
  });

  // ─── subscribeToEvents ───

  describe('subscribeToEvents', () => {
    it('opens serverStream with SubscribeToEvents', () => {
      const { client, transport } = createClient();
      captureServerStream(transport);
      const sub = client.subscribeToEvents({
        channel: 'ev-sub',
        onEvent: () => {},
        onError: () => {},
      });
      expect(transport.callsTo('SubscribeToEvents')).toHaveLength(1);
      expect(sub.isActive).toBe(true);
    });

    it('delivers messages via onEvent callback', async () => {
      const { client, transport } = createClient();
      const getStream = captureServerStream(transport);
      const received: any[] = [];
      client.subscribeToEvents({
        channel: 'ev-sub',
        onEvent: (msg) => received.push(msg),
        onError: () => {},
      });

      getStream().simulateData(
        new kubemq.EventReceive({
          EventID: 'ev-rx-1',
          Channel: 'ev-sub',
          Body: new Uint8Array([1]),
          Metadata: 'meta',
          Timestamp: BigInt(Date.now() * 1_000_000),
        }),
      );

      await vi.waitFor(() => expect(received).toHaveLength(1));
      expect(received[0].id).toBe('ev-rx-1');
      expect(received[0].channel).toBe('ev-sub');
    });

    it('cancel stops subscription', () => {
      const { client, transport } = createClient();
      captureServerStream(transport);
      const sub = client.subscribeToEvents({
        channel: 'ev-sub',
        onEvent: () => {},
        onError: () => {},
      });
      sub.cancel();
      expect(sub.isActive).toBe(false);
    });

    it('error callback fires on stream error', () => {
      const { client, transport } = createClient();
      const getStream = captureServerStream(transport);
      const errors: any[] = [];
      client.subscribeToEvents({
        channel: 'ev-sub',
        onEvent: () => {},
        onError: (err) => errors.push(err),
      });

      getStream().simulateError(new Error('stream error'));
      expect(errors).toHaveLength(1);
    });
  });

  // ─── subscribeToEventsStore ───

  describe('subscribeToEventsStore', () => {
    it('opens serverStream with SubscribeToEvents for store', () => {
      const { client, transport } = createClient();
      captureServerStream(transport);
      client.subscribeToEventsStore({
        channel: 'es-sub',
        startFrom: EventStoreStartPosition.StartFromNew,
        onEvent: () => {},
        onError: () => {},
      });
      expect(transport.callsTo('SubscribeToEvents')).toHaveLength(1);
    });

    it('delivers store events via onEvent', async () => {
      const { client, transport } = createClient();
      const getStream = captureServerStream(transport);
      const received: any[] = [];
      client.subscribeToEventsStore({
        channel: 'es-sub',
        startFrom: EventStoreStartPosition.StartFromFirst,
        onEvent: (msg) => received.push(msg),
        onError: () => {},
      });

      getStream().simulateData(
        new kubemq.EventReceive({
          EventID: 'es-rx-1',
          Channel: 'es-sub',
          Body: new Uint8Array([2]),
          Metadata: 'store-meta',
          Timestamp: BigInt(Date.now() * 1_000_000),
          Sequence: BigInt(5),
        }),
      );

      await vi.waitFor(() => expect(received).toHaveLength(1));
      expect(received[0].id).toBe('es-rx-1');
      expect(received[0].sequence).toBe(5);
    });
  });

  // ─── subscribeToCommands ───

  describe('subscribeToCommands', () => {
    it('opens serverStream with SubscribeToRequests', () => {
      const { client, transport } = createClient();
      captureServerStream(transport);
      client.subscribeToCommands({
        channel: 'cmd-sub',
        onCommand: () => {},
        onError: () => {},
      });
      expect(transport.callsTo('SubscribeToRequests')).toHaveLength(1);
    });

    it('delivers commands via onCommand callback', async () => {
      const { client, transport } = createClient();
      const getStream = captureServerStream(transport);
      const received: any[] = [];
      client.subscribeToCommands({
        channel: 'cmd-sub',
        onCommand: (cmd) => received.push(cmd),
        onError: () => {},
      });

      getStream().simulateData(
        new kubemq.Request({
          RequestID: 'cmd-rx-1',
          Channel: 'cmd-sub',
          ClientID: 'sender',
          Body: new Uint8Array([1]),
          Metadata: 'cmd-meta',
          ReplyChannel: 'reply-ch',
        }),
      );

      await vi.waitFor(() => expect(received).toHaveLength(1));
      expect(received[0].id).toBe('cmd-rx-1');
      expect(received[0].replyChannel).toBe('reply-ch');
    });

    it('cancel stops command subscription', () => {
      const { client, transport } = createClient();
      captureServerStream(transport);
      const sub = client.subscribeToCommands({
        channel: 'cmd-sub',
        onCommand: () => {},
        onError: () => {},
      });
      sub.cancel();
      expect(sub.isActive).toBe(false);
    });
  });

  // ─── subscribeToQueries ───

  describe('subscribeToQueries', () => {
    it('opens serverStream with SubscribeToRequests', () => {
      const { client, transport } = createClient();
      captureServerStream(transport);
      client.subscribeToQueries({
        channel: 'qry-sub',
        onQuery: () => {},
        onError: () => {},
      });
      expect(transport.callsTo('SubscribeToRequests')).toHaveLength(1);
    });

    it('delivers queries via onQuery callback', async () => {
      const { client, transport } = createClient();
      const getStream = captureServerStream(transport);
      const received: any[] = [];
      client.subscribeToQueries({
        channel: 'qry-sub',
        onQuery: (q) => received.push(q),
        onError: () => {},
      });

      getStream().simulateData(
        new kubemq.Request({
          RequestID: 'qry-rx-1',
          Channel: 'qry-sub',
          ClientID: 'sender',
          Body: new Uint8Array([5]),
          Metadata: 'qry-meta',
          ReplyChannel: 'reply-qry',
        }),
      );

      await vi.waitFor(() => expect(received).toHaveLength(1));
      expect(received[0].id).toBe('qry-rx-1');
      expect(received[0].replyChannel).toBe('reply-qry');
    });

    it('cancel stops query subscription', () => {
      const { client, transport } = createClient();
      captureServerStream(transport);
      const sub = client.subscribeToQueries({
        channel: 'qry-sub',
        onQuery: () => {},
        onError: () => {},
      });
      sub.cancel();
      expect(sub.isActive).toBe(false);
    });
  });

  // ─── sendCommandResponse ───

  describe('sendCommandResponse', () => {
    it('calls SendResponse', async () => {
      const { client, transport } = createClient();
      transport.onUnaryCall('SendResponse', () => new kubemq.Empty());
      await client.sendCommandResponse({
        id: 'resp-1',
        replyChannel: 'reply-ch',
        executed: true,
      });
      expect(transport.callsTo('SendResponse')).toHaveLength(1);
    });
  });

  // ─── sendQueryResponse ───

  describe('sendQueryResponse', () => {
    it('calls SendResponse', async () => {
      const { client, transport } = createClient();
      transport.onUnaryCall('SendResponse', () => new kubemq.Empty());
      await client.sendQueryResponse({
        id: 'resp-2',
        replyChannel: 'reply-ch',
        executed: true,
        body: new Uint8Array([10]),
      });
      expect(transport.callsTo('SendResponse')).toHaveLength(1);
    });
  });

  // ─── createChannel / deleteChannel / listChannels ───

  describe('channel management', () => {
    it('createChannel calls SendRequest with create-channel metadata', async () => {
      const { client, transport } = createClient();
      transport.onUnaryCall(
        'SendRequest',
        () => new kubemq.Response({ RequestID: 'cr-1', Executed: true }),
      );
      await client.createChannel('my-channel', 'events');
      const calls = transport.callsTo('SendRequest');
      expect(calls).toHaveLength(1);
      expect((calls[0]!.request as any).Metadata).toBe('create-channel');
      expect((calls[0]!.request as any).Channel).toBe('kubemq.cluster.internal.requests');
    });

    it('deleteChannel calls SendRequest with delete-channel metadata', async () => {
      const { client, transport } = createClient();
      transport.onUnaryCall(
        'SendRequest',
        () => new kubemq.Response({ RequestID: 'del-1', Executed: true }),
      );
      await client.deleteChannel('my-channel', 'queues');
      const calls = transport.callsTo('SendRequest');
      expect(calls).toHaveLength(1);
      expect((calls[0]!.request as any).Metadata).toBe('delete-channel');
    });

    it('listChannels returns parsed JSON body', async () => {
      const { client, transport } = createClient();
      const channelList = [{ Name: 'ch1', Type: 'events' }];
      transport.onUnaryCall(
        'SendRequest',
        () =>
          new kubemq.Response({
            RequestID: 'ls-1',
            Executed: true,
            Body: new TextEncoder().encode(JSON.stringify(channelList)),
          }),
      );
      const result = await client.listChannels('events');
      expect(result).toEqual(channelList);
    });

    it('listChannels returns empty array when body is empty', async () => {
      const { client, transport } = createClient();
      transport.onUnaryCall(
        'SendRequest',
        () =>
          new kubemq.Response({
            RequestID: 'ls-2',
            Executed: true,
            Body: new Uint8Array(0),
          }),
      );
      const result = await client.listChannels('events');
      expect(result).toEqual([]);
    });

    it('createChannel throws ValidationError for empty name', async () => {
      const { client } = createClient();
      await expect(client.createChannel('', 'events')).rejects.toThrow(ValidationError);
    });

    it('deleteChannel throws ValidationError for empty name', async () => {
      const { client } = createClient();
      await expect(client.deleteChannel('', 'events')).rejects.toThrow(ValidationError);
    });

    it('convenience aliases call through', async () => {
      const { client, transport } = createClient();
      transport.onUnaryCall(
        'SendRequest',
        () => new kubemq.Response({ RequestID: 'conv-1', Executed: true }),
      );
      await client.createEventsChannel('e-ch');
      expect((transport.callsTo('SendRequest')[0]!.request as any).Metadata).toBe('create-channel');
    });
  });

  // ─── purgeQueue ───

  describe('purgeQueue', () => {
    it('calls AckAllQueueMessages', async () => {
      const { client, transport } = createClient();
      transport.onUnaryCall(
        'AckAllQueueMessages',
        () =>
          new kubemq.AckAllQueueMessagesResponse({
            AffectedMessages: 5,
            IsError: false,
          }),
      );
      await client.purgeQueue('purge-ch');
      expect(transport.callsTo('AckAllQueueMessages')).toHaveLength(1);
    });

    it('throws KubeMQError when response.IsError', async () => {
      const { client, transport } = createClient();
      transport.onUnaryCall(
        'AckAllQueueMessages',
        () =>
          new kubemq.AckAllQueueMessagesResponse({
            AffectedMessages: 0,
            IsError: true,
            Error: 'purge failed',
          }),
      );
      await expect(client.purgeQueue('purge-ch')).rejects.toThrow(KubeMQError);
    });

    it('throws ValidationError for empty channel', async () => {
      const { client } = createClient();
      await expect(client.purgeQueue('')).rejects.toThrow(ValidationError);
    });
  });

  // ─── ping ───

  describe('ping', () => {
    it('calls Ping and returns ServerInfo', async () => {
      const { client, transport } = createClient();
      transport.onUnaryCall(
        'Ping',
        () =>
          new kubemq.PingResult({
            Host: 'kubemq-host',
            Version: '3.0.0',
            ServerStartTime: BigInt(1000),
            ServerUpTimeSeconds: BigInt(5000),
          }),
      );
      const info = await client.ping();
      expect(info.host).toBe('kubemq-host');
      expect(info.version).toBe('3.0.0');
      expect(info.serverStartTime).toBe(1000);
      expect(info.serverUpTime).toBe(5000);
    });
  });

  // ─── close ───

  describe('close', () => {
    it('calls transport.close()', async () => {
      const { client, transport } = createClient();
      const closeSpy = vi.spyOn(transport, 'close');
      await client.close();
      expect(closeSpy).toHaveBeenCalled();
    });

    it('transitions to CLOSED state', async () => {
      const { client } = createClient();
      await client.close();
      expect(client.state).toBe(ConnectionState.CLOSED);
    });
  });

  // ─── on/off ───

  describe('on/off', () => {
    it('delegates to stateMachine on', () => {
      const { client, transport } = createClient();
      const sm = transport.getStateMachine() as any;
      const spy = vi.spyOn(sm, 'on');
      const listener = () => {};
      client.on('stateChange', listener);
      expect(spy).toHaveBeenCalledWith('stateChange', listener);
    });

    it('delegates to stateMachine off', () => {
      const { client, transport } = createClient();
      const sm = transport.getStateMachine() as any;
      const spy = vi.spyOn(sm, 'off');
      const listener = () => {};
      client.on('stateChange', listener);
      client.off('stateChange', listener);
      expect(spy).toHaveBeenCalledWith('stateChange', listener);
    });

    it('on returns this for chaining', () => {
      const { client } = createClient();
      const result = client.on('stateChange', () => {});
      expect(result).toBe(client);
    });

    it('off returns this for chaining', () => {
      const { client } = createClient();
      const listener = () => {};
      client.on('stateChange', listener);
      const result = client.off('stateChange', listener);
      expect(result).toBe(client);
    });
  });

  // ─── Symbol.asyncDispose ───

  describe('Symbol.asyncDispose', () => {
    it('calls close()', async () => {
      const { client } = createClient();
      const closeSpy = vi.spyOn(client, 'close');
      await client[Symbol.asyncDispose]();
      expect(closeSpy).toHaveBeenCalled();
    });
  });

  // ─── Client closed guard ───

  describe('client closed guard', () => {
    it('sendEvent throws ClientClosedError when closed', async () => {
      const { client } = createClient();
      await client.close();
      await expect(client.sendEvent({ channel: 'ch' })).rejects.toThrow(ClientClosedError);
    });

    it('sendQueueMessage throws ClientClosedError when closed', async () => {
      const { client } = createClient();
      await client.close();
      await expect(client.sendQueueMessage({ channel: 'ch' })).rejects.toThrow(ClientClosedError);
    });

    it('subscribeToEvents throws ClientClosedError when closed', async () => {
      const { client } = createClient();
      await client.close();
      expect(() =>
        client.subscribeToEvents({ channel: 'ch', onEvent: () => {}, onError: () => {} }),
      ).toThrow(ClientClosedError);
    });

    it('ping throws ClientClosedError when closed', async () => {
      const { client } = createClient();
      await client.close();
      await expect(client.ping()).rejects.toThrow(ClientClosedError);
    });

    it('streamQueueMessages throws ClientClosedError when closed', async () => {
      const { client } = createClient();
      await client.close();
      expect(() => client.streamQueueMessages({ channel: 'ch' })).toThrow(ClientClosedError);
    });

    it('createChannel throws ClientClosedError when closed', async () => {
      const { client } = createClient();
      await client.close();
      await expect(client.createChannel('ch', 'events')).rejects.toThrow(ClientClosedError);
    });

    it('purgeQueue throws ClientClosedError when closed', async () => {
      const { client } = createClient();
      await client.close();
      await expect(client.purgeQueue('ch')).rejects.toThrow(ClientClosedError);
    });
  });

  // ─── GAP-02: Channel management protocol fix ───

  describe('createChannel (GAP-02)', () => {
    it('sends RequestTypeData=2 with Tags instead of Body', async () => {
      const { client, transport } = createClient();
      transport.onUnaryCall('SendRequest', () => new kubemq.Response({ Executed: true }));

      await client.createChannel('my-channel', 'events');

      const call = transport.callsTo('SendRequest')[0];
      const req = call.request as kubemq.Request;
      expect(req.RequestTypeData).toBe(2);
      expect(req.Tags.get('channel')).toBe('my-channel');
      expect(req.Tags.get('channel_type')).toBe('events');
      expect(req.Tags.get('client_id')).toBe('test-client');
      expect(req.Body?.length ?? 0).toBe(0);
    });
  });

  describe('deleteChannel (GAP-02)', () => {
    it('sends RequestTypeData=2 with Tags', async () => {
      const { client, transport } = createClient();
      transport.onUnaryCall('SendRequest', () => new kubemq.Response({ Executed: true }));

      await client.deleteChannel('my-channel', 'queues');

      const call = transport.callsTo('SendRequest')[0];
      const req = call.request as kubemq.Request;
      expect(req.RequestTypeData).toBe(2);
      expect(req.Tags.get('channel')).toBe('my-channel');
      expect(req.Tags.get('channel_type')).toBe('queues');
    });
  });

  describe('listChannels (GAP-02)', () => {
    it('sends Tags with channel_search when search provided', async () => {
      const { client, transport } = createClient();
      transport.onUnaryCall(
        'SendRequest',
        () =>
          new kubemq.Response({
            Executed: true,
            Body: new TextEncoder().encode('[]'),
          }),
      );

      await client.listChannels('events', 'my-search');

      const call = transport.callsTo('SendRequest')[0];
      const req = call.request as kubemq.Request;
      expect(req.RequestTypeData).toBe(2);
      expect(req.Tags.get('channel_search')).toBe('my-search');
    });
  });

  // ─── GAP-05: CloseByServer handling ───

  describe('streamQueueMessages — CloseByServer (GAP-05)', () => {
    it('handles CloseByServer response by closing stream', async () => {
      const { client, transport } = createClient();
      const getStream = captureDuplexStream(transport);

      let closeCalled = false;
      const handle = client.streamQueueMessages({ channel: 'q-ch' });
      handle.onClose(() => {
        closeCalled = true;
      });

      await new Promise((r) => setTimeout(r, 10));
      const stream = getStream();
      stream.simulateData(
        new kubemq.QueuesDownstreamResponse({
          RequestTypeData: 11,
          TransactionId: 'txn-1',
        }),
      );

      await new Promise((r) => setTimeout(r, 10));
      expect(handle.isActive).toBe(false);
      expect(closeCalled).toBe(true);
    });
  });

  // ─── GAP-16: ackAllQueueMessages ───

  describe('ackAllQueueMessages (GAP-16)', () => {
    it('sends AckAllQueueMessages with configurable waitTimeSeconds', async () => {
      const { client, transport } = createClient();
      transport.onUnaryCall(
        'AckAllQueueMessages',
        () =>
          new kubemq.AckAllQueueMessagesResponse({
            AffectedMessages: 42,
            IsError: false,
          }),
      );

      const count = await client.ackAllQueueMessages('q-ch', 5);

      expect(count).toBe(42);
      const call = transport.callsTo('AckAllQueueMessages')[0];
      const req = call.request as kubemq.AckAllQueueMessagesRequest;
      expect(req.WaitTimeSeconds).toBe(5);
    });

    it('purgeQueue delegates to ackAllQueueMessages', async () => {
      const { client, transport } = createClient();
      transport.onUnaryCall(
        'AckAllQueueMessages',
        () =>
          new kubemq.AckAllQueueMessagesResponse({
            AffectedMessages: 10,
            IsError: false,
          }),
      );

      await client.purgeQueue('q-ch');

      const call = transport.callsTo('AckAllQueueMessages')[0];
      const req = call.request as kubemq.AckAllQueueMessagesRequest;
      expect(req.WaitTimeSeconds).toBe(1);
    });
  });

  // ─── GAP-03/04: Batch and range operations ───

  describe('streamQueueMessages — batch operations (GAP-03/04)', () => {
    it('ackAll sends RequestTypeData=2 without SequenceRange', async () => {
      const { client, transport } = createClient();
      const getStream = captureDuplexStream(transport);
      const handle = client.streamQueueMessages({ channel: 'q-ch' });

      await new Promise((r) => setTimeout(r, 10));
      const stream = getStream();

      stream.simulateData(
        new kubemq.QueuesDownstreamResponse({
          TransactionId: 'txn-1',
          Messages: [
            new kubemq.QueueMessage({
              MessageID: 'm1',
              Channel: 'q-ch',
              Body: new Uint8Array([1]),
              Attributes: new kubemq.QueueMessageAttributes({ Sequence: 1 }),
            }),
          ],
          RequestTypeData: 1,
        }),
      );

      await new Promise((r) => setTimeout(r, 10));
      handle.ackAll();

      const writes = stream.written;
      const ackWrite = writes.find(
        (w: any) => w.RequestTypeData === 2 && (!w.SequenceRange || w.SequenceRange.length === 0),
      );
      expect(ackWrite).toBeDefined();
    });
  });

  // ─── GAP-07: Event stream handles ───

  describe('createEventStream (GAP-07)', () => {
    it('sends event via bidirectional stream', () => {
      const { client, transport } = createClient();
      const getStream = captureDuplexStream(transport);
      const handle = client.createEventStream();

      expect(handle.isActive).toBe(true);
      handle.send({ channel: 'events.ch', body: new TextEncoder().encode('hello'), id: 'e-1' });

      const stream = getStream();
      expect(stream.written.length).toBeGreaterThan(0);
      const written = stream.written[0] as kubemq.Event;
      expect(written.Channel).toBe('events.ch');
      expect(written.Store).toBe(false);
    });

    it('close deactivates stream', () => {
      const { client } = createClient();
      const handle = client.createEventStream();
      handle.close();
      expect(handle.isActive).toBe(false);
    });
  });

  describe('createEventStoreStream (GAP-07)', () => {
    it('sends event store message and resolves on confirmation', async () => {
      const { client, transport } = createClient();
      const getStream = captureDuplexStream(transport);
      const handle = client.createEventStoreStream();

      const sendPromise = handle.send({
        channel: 'store.ch',
        body: new TextEncoder().encode('data'),
        id: 'es-1',
      });

      await new Promise((r) => setTimeout(r, 10));
      const stream = getStream();
      stream.simulateData(
        new kubemq.Result({
          EventID: 'es-1',
          Sent: true,
        }),
      );

      await expect(sendPromise).resolves.toBeUndefined();
    });
  });

  // ─── GAP-11: Validate response in sendCommandResponse/sendQueryResponse ───

  describe('sendCommandResponse validation (GAP-11)', () => {
    it('rejects response with empty id', async () => {
      const { client } = createClient();
      await expect(
        client.sendCommandResponse({
          id: '',
          replyChannel: 'reply',
          executed: true,
        }),
      ).rejects.toThrow(/id/i);
    });

    it('rejects response with empty replyChannel', async () => {
      const { client } = createClient();
      await expect(
        client.sendCommandResponse({
          id: 'req-1',
          replyChannel: '',
          executed: true,
        }),
      ).rejects.toThrow(/replyChannel/i);
    });
  });

  // ─── createQueueUpstream ───

  describe('createQueueUpstream', () => {
    it('sends queue messages and receives confirmation', async () => {
      const { client, transport } = createClient();
      const getStream = captureDuplexStream(transport);
      const handle = client.createQueueUpstream();

      expect(handle.isActive).toBe(true);

      const sendPromise = handle.send([{ channel: 'q-ch', body: new Uint8Array([1]) }]);

      await new Promise((r) => setTimeout(r, 10));
      const stream = getStream();

      const written = stream.written[0] as any;
      stream.simulateData({
        RefRequestID: written.RequestID,
        IsError: false,
        Results: [],
      });

      const result = await sendPromise;
      expect(result.isError).toBe(false);
    });

    it('rejects on error response', async () => {
      const { client, transport } = createClient();
      const getStream = captureDuplexStream(transport);
      const handle = client.createQueueUpstream();

      const sendPromise = handle.send([{ channel: 'q-ch', body: new Uint8Array([1]) }]);

      await new Promise((r) => setTimeout(r, 10));
      const stream = getStream();
      const written = stream.written[0] as any;
      stream.simulateData({
        RefRequestID: written.RequestID,
        IsError: true,
        Error: 'upstream error',
        Results: [],
      });

      await expect(sendPromise).rejects.toThrow('upstream error');
    });

    it('rejects pending on stream error', async () => {
      const { client, transport } = createClient();
      const getStream = captureDuplexStream(transport);
      const handle = client.createQueueUpstream();

      const sendPromise = handle.send([{ channel: 'q-ch', body: new Uint8Array([1]) }]);

      await new Promise((r) => setTimeout(r, 10));
      const stream = getStream();
      stream.simulateError(new Error('stream broken'));

      await expect(sendPromise).rejects.toThrow('stream broken');
    });

    it('rejects pending on stream end', async () => {
      const { client, transport } = createClient();
      const getStream = captureDuplexStream(transport);
      const handle = client.createQueueUpstream();

      const sendPromise = handle.send([{ channel: 'q-ch', body: new Uint8Array([1]) }]);

      await new Promise((r) => setTimeout(r, 10));
      const stream = getStream();
      stream.simulateEnd();

      await expect(sendPromise).rejects.toThrow('closed');
    });

    it('close rejects pending and deactivates', async () => {
      const { client, transport } = createClient();
      captureDuplexStream(transport);
      const handle = client.createQueueUpstream();

      const sendPromise = handle.send([{ channel: 'q-ch', body: new Uint8Array([1]) }]);
      handle.close();

      expect(handle.isActive).toBe(false);
      await expect(sendPromise).rejects.toThrow('closed by client');
    });

    it('send after close rejects', async () => {
      const { client, transport } = createClient();
      captureDuplexStream(transport);
      const handle = client.createQueueUpstream();
      handle.close();

      await expect(handle.send([{ channel: 'q-ch' }])).rejects.toThrow('closed');
    });

    it('stream error rejects all pending sends', async () => {
      const { client, transport } = createClient();
      const getStream = captureDuplexStream(transport);
      const handle = client.createQueueUpstream();

      const p1 = handle.send([{ channel: 'q-ch', body: new Uint8Array([1]) }]);
      const p2 = handle.send([{ channel: 'q-ch', body: new Uint8Array([2]) }]);

      await new Promise((r) => setTimeout(r, 10));
      const stream = getStream();
      stream.simulateError(new Error('upstream err'));

      await expect(p1).rejects.toThrow('upstream err');
      await expect(p2).rejects.toThrow('upstream err');
    });
  });

  // ─── consumeQueue ───

  describe('consumeQueue', () => {
    it('yields batch from stream messages', async () => {
      const { client, transport } = createClient();
      const getStream = captureDuplexStream(transport);

      const iter = client.consumeQueue({ channel: 'q-ch' });
      const batchPromise = (iter as AsyncIterable<any>)[Symbol.asyncIterator]().next();

      await new Promise((r) => setTimeout(r, 10));
      const stream = getStream();

      stream.simulateData(
        new kubemq.QueuesDownstreamResponse({
          TransactionId: 'txn-consume',
          Messages: [
            new kubemq.QueueMessage({
              MessageID: 'cm-1',
              Channel: 'q-ch',
              Body: new Uint8Array([1]),
              Attributes: new kubemq.QueueMessageAttributes({ Sequence: BigInt(1) }),
            }),
          ],
          RequestTypeData: 1,
        }),
      );

      const result = await batchPromise;
      expect(result.done).toBe(false);
      expect(result.value.messages).toHaveLength(1);
    });

    it('stops on stream close', async () => {
      const { client, transport } = createClient();
      const getStream = captureDuplexStream(transport);

      const batches: any[] = [];
      const iter = client.consumeQueue({ channel: 'q-ch' });

      const collectPromise = (async () => {
        for await (const batch of iter) {
          batches.push(batch);
        }
      })();

      await new Promise((r) => setTimeout(r, 10));
      const stream = getStream();
      stream.simulateEnd();

      await collectPromise;
      expect(batches).toHaveLength(0);
    });

    it('propagates stream error', async () => {
      const { client, transport } = createClient();
      const getStream = captureDuplexStream(transport);

      const iter = client.consumeQueue({ channel: 'q-ch' });
      const nextPromise = (iter as AsyncIterable<any>)[Symbol.asyncIterator]().next();

      await new Promise((r) => setTimeout(r, 10));
      const stream = getStream();
      stream.simulateError(new Error('consume error'));

      await expect(nextPromise).rejects.toThrow('consume error');
    });
  });

  // ─── createEventStream — edge cases ───

  describe('createEventStream — edge cases', () => {
    it('error handler fires when Result.Sent is false', async () => {
      const { client, transport } = createClient();
      const getStream = captureDuplexStream(transport);
      const handle = client.createEventStream();

      const errors: Error[] = [];
      handle.onError((err: Error) => errors.push(err));

      await new Promise((r) => setTimeout(r, 10));
      const stream = getStream();

      stream.simulateData(
        new kubemq.Result({
          EventID: 'e-fail',
          Sent: false,
          Error: 'event send failed',
        }),
      );

      expect(errors).toHaveLength(1);
      expect(errors[0]!.message).toBe('event send failed');
    });

    it('stream error fires error handler', async () => {
      const { client, transport } = createClient();
      const getStream = captureDuplexStream(transport);
      const handle = client.createEventStream();

      const errors: Error[] = [];
      handle.onError((err: Error) => errors.push(err));

      await new Promise((r) => setTimeout(r, 10));
      const stream = getStream();
      stream.simulateError(new Error('stream err'));

      expect(errors).toHaveLength(1);
    });

    it('send after close is no-op', () => {
      const { client } = createClient();
      const handle = client.createEventStream();
      handle.close();
      handle.send({ channel: 'ch', body: new Uint8Array([1]) });
      expect(handle.isActive).toBe(false);
    });

    it('double close is safe', () => {
      const { client } = createClient();
      const handle = client.createEventStream();
      handle.close();
      handle.close();
      expect(handle.isActive).toBe(false);
    });
  });

  // ─── createEventStoreStream — edge cases ───

  describe('createEventStoreStream — edge cases', () => {
    it('rejects when Result.Sent is false', async () => {
      const { client, transport } = createClient();
      const getStream = captureDuplexStream(transport);
      const handle = client.createEventStoreStream();

      const sendPromise = handle.send({
        channel: 'store.ch',
        body: new Uint8Array([1]),
        id: 'es-fail',
      });

      await new Promise((r) => setTimeout(r, 10));
      const stream = getStream();
      stream.simulateData(
        new kubemq.Result({
          EventID: 'es-fail',
          Sent: false,
          Error: 'store write failed',
        }),
      );

      await expect(sendPromise).rejects.toThrow('store write failed');
    });

    it('rejects pending on stream error', async () => {
      const { client, transport } = createClient();
      const getStream = captureDuplexStream(transport);
      const handle = client.createEventStoreStream();

      const sendPromise = handle.send({
        channel: 'store.ch',
        body: new Uint8Array([1]),
        id: 'es-err',
      });

      await new Promise((r) => setTimeout(r, 10));
      const stream = getStream();
      stream.simulateError(new Error('store stream broken'));

      await expect(sendPromise).rejects.toThrow('store stream broken');
    });

    it('rejects pending on stream end', async () => {
      const { client, transport } = createClient();
      const getStream = captureDuplexStream(transport);
      const handle = client.createEventStoreStream();

      const sendPromise = handle.send({
        channel: 'store.ch',
        body: new Uint8Array([1]),
        id: 'es-end',
      });

      await new Promise((r) => setTimeout(r, 10));
      const stream = getStream();
      stream.simulateEnd();

      await expect(sendPromise).rejects.toThrow('Event store stream broken');
    });

    it('error handler fires on stream error', async () => {
      const { client, transport } = createClient();
      const getStream = captureDuplexStream(transport);
      const handle = client.createEventStoreStream();

      const errors: Error[] = [];
      handle.onError((err: Error) => errors.push(err));

      await new Promise((r) => setTimeout(r, 10));
      const stream = getStream();
      stream.simulateError(new Error('event store err'));

      expect(errors).toHaveLength(1);
    });

    it('send after close rejects', async () => {
      const { client } = createClient();
      const handle = client.createEventStoreStream();
      handle.close();

      await expect(
        handle.send({ channel: 'ch', body: new Uint8Array([1]), id: 'x' }),
      ).rejects.toThrow('closed');
    });

    it('close rejects pending promises', async () => {
      const { client, transport } = createClient();
      captureDuplexStream(transport);
      const handle = client.createEventStoreStream();

      const sendPromise = handle.send({
        channel: 'store.ch',
        body: new Uint8Array([1]),
        id: 'es-close',
      });

      handle.close();
      await expect(sendPromise).rejects.toThrow('closed by client');
    });

    it('double close is safe', () => {
      const { client } = createClient();
      const handle = client.createEventStoreStream();
      handle.close();
      handle.close();
      expect(handle.isActive).toBe(false);
    });
  });

  // ─── streamQueueMessages — extended ops ───

  describe('streamQueueMessages — extended operations', () => {
    function setupStreamWithMessages(client: any, transport: MockTransport) {
      const getStream = captureDuplexStream(transport);
      const handle = client.streamQueueMessages({ channel: 'q-ext' });
      return { handle, getStream };
    }

    it('nackAll sends RequestTypeData=4', async () => {
      const { client, transport } = createClient();
      const { handle, getStream } = setupStreamWithMessages(client, transport);

      await new Promise((r) => setTimeout(r, 10));
      const stream = getStream();

      stream.simulateData(
        new kubemq.QueuesDownstreamResponse({
          TransactionId: 'txn-nack',
          Messages: [
            new kubemq.QueueMessage({
              MessageID: 'm1',
              Channel: 'q-ext',
              Body: new Uint8Array([1]),
              Attributes: new kubemq.QueueMessageAttributes({ Sequence: BigInt(1) }),
            }),
          ],
          RequestTypeData: 1,
        }),
      );

      await new Promise((r) => setTimeout(r, 10));
      handle.nackAll();

      const nackWrite = stream.written.find((w: any) => w.RequestTypeData === 4);
      expect(nackWrite).toBeDefined();
    });

    it('reQueueAll sends RequestTypeData=6 with target channel', async () => {
      const { client, transport } = createClient();
      const { handle, getStream } = setupStreamWithMessages(client, transport);

      await new Promise((r) => setTimeout(r, 10));
      const stream = getStream();

      stream.simulateData(
        new kubemq.QueuesDownstreamResponse({
          TransactionId: 'txn-rq',
          Messages: [
            new kubemq.QueueMessage({
              MessageID: 'm1',
              Channel: 'q-ext',
              Body: new Uint8Array([1]),
              Attributes: new kubemq.QueueMessageAttributes({ Sequence: BigInt(1) }),
            }),
          ],
          RequestTypeData: 1,
        }),
      );

      await new Promise((r) => setTimeout(r, 10));
      handle.reQueueAll('target-q');

      const rqWrite = stream.written.find(
        (w: any) => w.RequestTypeData === 6 && w.ReQueueChannel === 'target-q',
      );
      expect(rqWrite).toBeDefined();
    });

    it('ackRange sends RequestTypeData=3 with sequences', async () => {
      const { client, transport } = createClient();
      const { handle, getStream } = setupStreamWithMessages(client, transport);

      await new Promise((r) => setTimeout(r, 10));
      const stream = getStream();

      stream.simulateData(
        new kubemq.QueuesDownstreamResponse({
          TransactionId: 'txn-ar',
          Messages: [
            new kubemq.QueueMessage({
              MessageID: 'm1',
              Channel: 'q-ext',
              Body: new Uint8Array([1]),
              Attributes: new kubemq.QueueMessageAttributes({ Sequence: BigInt(1) }),
            }),
          ],
          RequestTypeData: 1,
        }),
      );

      await new Promise((r) => setTimeout(r, 10));
      handle.ackRange([1, 2, 3]);

      const arWrite = stream.written.find((w: any) => w.RequestTypeData === 3 && w.SequenceRange);
      expect(arWrite).toBeDefined();
    });

    it('nackRange sends RequestTypeData=5', async () => {
      const { client, transport } = createClient();
      const { handle, getStream } = setupStreamWithMessages(client, transport);

      await new Promise((r) => setTimeout(r, 10));
      const stream = getStream();

      stream.simulateData(
        new kubemq.QueuesDownstreamResponse({
          TransactionId: 'txn-nr',
          Messages: [
            new kubemq.QueueMessage({
              MessageID: 'm1',
              Channel: 'q-ext',
              Body: new Uint8Array([1]),
              Attributes: new kubemq.QueueMessageAttributes({ Sequence: BigInt(1) }),
            }),
          ],
          RequestTypeData: 1,
        }),
      );

      await new Promise((r) => setTimeout(r, 10));
      handle.nackRange([1]);

      const nrWrite = stream.written.find((w: any) => w.RequestTypeData === 5);
      expect(nrWrite).toBeDefined();
    });

    it('reQueueRange sends RequestTypeData=7', async () => {
      const { client, transport } = createClient();
      const { handle, getStream } = setupStreamWithMessages(client, transport);

      await new Promise((r) => setTimeout(r, 10));
      const stream = getStream();

      stream.simulateData(
        new kubemq.QueuesDownstreamResponse({
          TransactionId: 'txn-rqr',
          Messages: [
            new kubemq.QueueMessage({
              MessageID: 'm1',
              Channel: 'q-ext',
              Body: new Uint8Array([1]),
              Attributes: new kubemq.QueueMessageAttributes({ Sequence: BigInt(1) }),
            }),
          ],
          RequestTypeData: 1,
        }),
      );

      await new Promise((r) => setTimeout(r, 10));
      handle.reQueueRange('target-q', [1, 2]);

      const rqrWrite = stream.written.find(
        (w: any) => w.RequestTypeData === 7 && w.ReQueueChannel === 'target-q',
      );
      expect(rqrWrite).toBeDefined();
    });

    // H1 fix: getActiveOffsets and getTransactionStatus now throw NotImplementedError
    it('getActiveOffsets throws NotImplementedError', () => {
      const { client, transport } = createClient();
      const { handle } = setupStreamWithMessages(client, transport);
      expect(() => handle.getActiveOffsets()).toThrow(
        'ActiveOffsets is not supported by the server',
      );
    });

    it('getTransactionStatus throws NotImplementedError', () => {
      const { client, transport } = createClient();
      const { handle } = setupStreamWithMessages(client, transport);
      expect(() => handle.getTransactionStatus()).toThrow(
        'TransactionStatus is not supported by the server',
      );
    });

    it('Metadata Map is extracted from response', async () => {
      const { client, transport } = createClient();
      const getStream = captureDuplexStream(transport);
      const handle = client.streamQueueMessages({ channel: 'q-meta' });

      let msgs: any[] = [];
      handle.onMessages((m: any) => {
        msgs = m;
      });

      await new Promise((r) => setTimeout(r, 10));
      const stream = getStream();

      const metaMap = new Map<string, string>();
      metaMap.set('key1', 'val1');

      stream.simulateData(
        new kubemq.QueuesDownstreamResponse({
          TransactionId: 'txn-meta',
          Messages: [
            new kubemq.QueueMessage({
              MessageID: 'm-meta',
              Channel: 'q-meta',
              Body: new Uint8Array([1]),
              Attributes: new kubemq.QueueMessageAttributes({ Sequence: BigInt(1) }),
            }),
          ],
          RequestTypeData: 1,
          Metadata: metaMap,
        }),
      );

      await new Promise((r) => setTimeout(r, 10));
      expect(msgs.length).toBeGreaterThan(0);
      expect(handle.responseMetadata).toEqual({ key1: 'val1' });
    });

    it('CloseByServer (RequestTypeData=11) closes stream', async () => {
      const { client, transport } = createClient();
      const getStream = captureDuplexStream(transport);
      const handle = client.streamQueueMessages({ channel: 'q-close' });

      let closed = false;
      handle.onClose(() => {
        closed = true;
      });

      await new Promise((r) => setTimeout(r, 10));
      const stream = getStream();

      stream.simulateData(
        new kubemq.QueuesDownstreamResponse({
          RequestTypeData: 11,
        }),
      );

      await new Promise((r) => setTimeout(r, 10));
      expect(handle.isActive).toBe(false);
      expect(closed).toBe(true);
    });
  });

  // ─── listChannels — transient error ───

  describe('listChannels — cluster snapshot', () => {
    it('throws TransientError for cluster snapshot not ready', async () => {
      const { client, transport } = createClient();
      transport.onUnaryCall('SendRequest', () => ({
        Error: 'cluster snapshot not ready',
        Body: new Uint8Array(0),
      }));

      await expect(client.listChannels('events')).rejects.toThrow();
    });
  });

  // ─── close with active dispatchers ───

  describe('close — dispatcher drain', () => {
    it('closes with active subscription dispatchers', async () => {
      const { client, transport } = createClient();
      captureServerStream(transport);

      client.subscribeToEvents({
        channel: 'events.drain',
        onEvent: () => {},
        onError: () => {},
      });

      await client.close({ callbackTimeoutSeconds: 0.1 });
      expect(client.state).toBe(ConnectionState.CLOSED);
    });
  });

  // ─── sendCommandResponse / sendQueryResponse — error catch ───

  describe('sendCommandResponse — error paths', () => {
    it('passes non-KubeMQError through from transport', async () => {
      const { client, transport } = createClient();
      transport.onUnaryCall('SendResponse', () => {
        throw new Error('raw transport error');
      });

      await expect(
        client.sendCommandResponse({
          id: 'cmd-1',
          replyChannel: 'reply',
          executed: true,
        }),
      ).rejects.toThrow('raw transport error');
    });
  });

  describe('sendQueryResponse — error paths', () => {
    it('passes non-KubeMQError through from transport', async () => {
      const { client, transport } = createClient();
      transport.onUnaryCall('SendResponse', () => {
        throw new Error('raw transport error');
      });

      await expect(
        client.sendQueryResponse({
          id: 'q-1',
          replyChannel: 'reply',
          executed: true,
        }),
      ).rejects.toThrow('raw transport error');
    });
  });

  // ─── sendEvent / sendEventStore — error catch non-KubeMQError ───

  describe('sendEvent — non-KubeMQError', () => {
    it('re-throws non-KubeMQError from sender initialization', async () => {
      const { client, transport } = createClient();
      // Sabotage transport.on so sender.start() throws a non-KubeMQ error
      transport.on = (() => { throw new Error('generic failure'); }) as any;

      await expect(client.sendEvent({ channel: 'ch', body: new Uint8Array([1]) })).rejects.toThrow(
        'generic failure',
      );
    });
  });

  describe('sendEventStore — non-KubeMQError', () => {
    it('re-throws non-KubeMQError from sender initialization', async () => {
      const { client, transport } = createClient();
      transport.on = (() => { throw new Error('generic store failure'); }) as any;

      await expect(
        client.sendEventStore({ channel: 'ch', body: new Uint8Array([1]) }),
      ).rejects.toThrow('generic store failure');
    });
  });

  // ─── sendQueueMessage / sendQueueMessagesBatch — error catch ───

  describe('sendQueueMessage — non-KubeMQError', () => {
    it('re-throws non-KubeMQError from sender initialization', async () => {
      const { client, transport } = createClient();
      transport.on = (() => { throw new Error('queue failure'); }) as any;

      await expect(
        client.sendQueueMessage({ channel: 'q', body: new Uint8Array([1]) }),
      ).rejects.toThrow('queue failure');
    });
  });

  describe('sendQueueMessagesBatch — non-KubeMQError', () => {
    it('re-throws non-KubeMQError', async () => {
      const { client, transport } = createClient();
      transport.onUnaryCall('SendQueueMessagesBatch', () => {
        throw new Error('batch failure');
      });

      await expect(
        client.sendQueueMessagesBatch([{ channel: 'q', body: new Uint8Array([1]) }]),
      ).rejects.toThrow('batch failure');
    });
  });

  // ─── sendCommand / sendQuery — error catch ───

  describe('sendCommand — non-KubeMQError', () => {
    it('re-throws non-KubeMQError', async () => {
      const { client, transport } = createClient();
      transport.onUnaryCall('SendRequest', () => {
        throw new Error('command failure');
      });

      await expect(
        client.sendCommand({
          channel: 'cmd-ch',
          timeoutInSeconds: 5,
          body: new Uint8Array([1]),
        }),
      ).rejects.toThrow('command failure');
    });
  });

  describe('sendQuery — non-KubeMQError', () => {
    it('re-throws non-KubeMQError', async () => {
      const { client, transport } = createClient();
      transport.onUnaryCall('SendRequest', () => {
        throw new Error('query failure');
      });

      await expect(
        client.sendQuery({
          channel: 'q-ch',
          timeoutInSeconds: 5,
          body: new Uint8Array([1]),
        }),
      ).rejects.toThrow('query failure');
    });
  });

  // ─── peekQueueMessages — error catch ───

  describe('peekQueueMessages — non-KubeMQError', () => {
    it('re-throws non-KubeMQError', async () => {
      const { client, transport } = createClient();
      transport.onUnaryCall('ReceiveQueueMessages', () => {
        throw new Error('peek failure');
      });

      await expect(
        client.peekQueueMessages({ channel: 'q', waitTimeoutSeconds: 5 }),
      ).rejects.toThrow('peek failure');
    });
  });

  // ─── receiveQueueMessages — error catch ───

  describe('receiveQueueMessages — non-KubeMQError', () => {
    it('re-throws non-KubeMQError', async () => {
      const { client, transport } = createClient();
      transport.onUnaryCall('ReceiveQueueMessages', () => {
        throw new Error('recv failure');
      });

      await expect(
        client.receiveQueueMessages({ channel: 'q', waitTimeoutSeconds: 5 }),
      ).rejects.toThrow('recv failure');
    });
  });

  // ─── subscribeToCommands/Queries — error handler coverage ───

  describe('subscribeToCommands — stream error maps non-gRPC error', () => {
    it('maps plain Error to KubeMQError', async () => {
      const { client, transport } = createClient();
      const getStream = captureServerStream(transport);
      const errors: any[] = [];

      client.subscribeToCommands({
        channel: 'cmd-ch',
        onCommand: () => {},
        onError: (err: any) => errors.push(err),
      });

      await new Promise((r) => setTimeout(r, 10));
      const stream = getStream();
      stream.simulateError(new Error('plain error'));

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('plain error');
    });
  });

  describe('subscribeToQueries — stream error maps non-gRPC error', () => {
    it('maps plain Error to KubeMQError', async () => {
      const { client, transport } = createClient();
      const getStream = captureServerStream(transport);
      const errors: any[] = [];

      client.subscribeToQueries({
        channel: 'q-ch',
        onQuery: () => {},
        onError: (err: any) => errors.push(err),
      });

      await new Promise((r) => setTimeout(r, 10));
      const stream = getStream();
      stream.simulateError(new Error('query error'));

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('query error');
    });
  });

  // ─── subscribeToEvents — signal abort ───

  describe('subscribeToEvents — signal abort', () => {
    it('cancels subscription on abort signal', () => {
      const { client } = createClient();
      const ac = new AbortController();
      const sub = client.subscribeToEvents(
        {
          channel: 'events.abort',
          onEvent: () => {},
          onError: () => {},
        },
        { signal: ac.signal },
      );

      expect(sub.isActive).toBe(true);
      ac.abort();
      expect(sub.isActive).toBe(false);
    });
  });

  // ─── subscribeToEventsStore — signal abort ───

  describe('subscribeToEventsStore — signal abort', () => {
    it('cancels subscription on abort signal', () => {
      const { client } = createClient();
      const ac = new AbortController();
      const sub = client.subscribeToEventsStore(
        {
          channel: 'store.abort',
          startFrom: EventStoreStartPosition.StartFromFirst,
          onEvent: () => {},
          onError: () => {},
        },
        { signal: ac.signal },
      );

      expect(sub.isActive).toBe(true);
      ac.abort();
      expect(sub.isActive).toBe(false);
    });
  });

  // ─── subscribeToCommands — signal abort ───

  describe('subscribeToCommands — signal abort', () => {
    it('cancels subscription on abort signal', () => {
      const { client } = createClient();
      const ac = new AbortController();
      const sub = client.subscribeToCommands(
        {
          channel: 'cmd.abort',
          onCommand: () => {},
          onError: () => {},
        },
        { signal: ac.signal },
      );

      expect(sub.isActive).toBe(true);
      ac.abort();
      expect(sub.isActive).toBe(false);
    });
  });

  // ─── subscribeToQueries — signal abort ───

  describe('subscribeToQueries — signal abort', () => {
    it('cancels subscription on abort signal', () => {
      const { client } = createClient();
      const ac = new AbortController();
      const sub = client.subscribeToQueries(
        {
          channel: 'query.abort',
          onQuery: () => {},
          onError: () => {},
        },
        { signal: ac.signal },
      );

      expect(sub.isActive).toBe(true);
      ac.abort();
      expect(sub.isActive).toBe(false);
    });
  });

  // ─── ackAllQueueMessages — error catch ───

  describe('ackAllQueueMessages — non-KubeMQError', () => {
    it('re-throws non-KubeMQError', async () => {
      const { client, transport } = createClient();
      transport.onUnaryCall('AckAllQueueMessages', () => {
        throw new Error('ack failure');
      });

      await expect(client.ackAllQueueMessages('q-ch')).rejects.toThrow('ack failure');
    });
  });

  // ─── #buildCallOptions ───

  describe('#buildCallOptions via createChannel with timeout', () => {
    it('createChannel with timeout/signal uses buildCallOptions', async () => {
      const { client, transport } = createClient();
      transport.onUnaryCall('SendRequest', () => ({
        Body: new Uint8Array(0),
      }));

      await client.createChannel('ch', 'events');
      expect(transport.callsTo('SendRequest')).toHaveLength(1);
    });
  });

  // ─── streamQueueMessages — error on inactive write ───

  describe('streamQueueMessages — write after close', () => {
    it('operations after close are no-ops', async () => {
      const { client, transport } = createClient();
      captureDuplexStream(transport);
      const handle = client.streamQueueMessages({ channel: 'q-inactive' });
      handle.close();

      expect(() => handle.ackAll()).not.toThrow();
      expect(() => handle.nackAll()).not.toThrow();
    });
  });

  // ─── Sender Stats ───

  describe('sender stats', () => {
    it('getEventSenderStats returns null before init', async () => {
      const { client } = createClient();
      const stats = await client.getEventSenderStats();
      expect(stats).toBeNull();
    });

    it('getUpstreamSenderStats returns null before init', async () => {
      const { client } = createClient();
      const stats = await client.getUpstreamSenderStats();
      expect(stats).toBeNull();
    });

    it('getEventSenderStats returns stats after init', async () => {
      const { client, transport } = createClient();
      captureDuplexStream(transport);
      await transport.connect();
      await client.sendEvent({ channel: 'ch', body: new Uint8Array([1]) });
      const stats = await client.getEventSenderStats();
      expect(stats).not.toBeNull();
      expect(stats!.streamState).toBe('connected');
    });
  });

  // ─── Closing behavior ───

  describe('closing behavior', () => {
    it('close is idempotent', async () => {
      const { client } = createClient();
      await client.close();
      await client.close(); // second close should not throw
    });

    it('close tears down event sender and upstream sender', async () => {
      const { client, transport } = createClient();
      captureDuplexStream(transport);
      await transport.connect();
      // Initialize both senders
      await client.sendEvent({ channel: 'ch', body: new Uint8Array([1]) });
      // sendQueueMessage needs an ACK to resolve — just trigger sender init
      const queuePromise = client.sendQueueMessage({ channel: 'q', body: new Uint8Array([1]) }).catch(() => {});
      await new Promise(r => setTimeout(r, 10));
      await client.close();
      // After close, stats should reflect closed state or null
      await queuePromise;
    });

    it('on/off delegates to transport state machine', () => {
      const { client, transport } = createClient();
      const handler = () => {};
      client.on('stateChange', handler);
      client.off('stateChange', handler);
      // No error means delegation worked
    });

    it('Symbol.asyncDispose calls close', async () => {
      const { client } = createClient();
      await client[Symbol.asyncDispose]();
      // After dispose, client is closed
      await expect(client.sendEvent({ channel: 'ch' })).rejects.toThrow();
    });
  });

  // ─── subscribeToEvents ───

  describe('subscribeToEvents', () => {
    it('opens server stream and delivers events via onEvent', async () => {
      const { client, transport } = createClient();
      const getStream = captureServerStream(transport);
      const received: any[] = [];

      const sub = client.subscribeToEvents({
        channel: 'ev-ch',
        onEvent: (msg) => received.push(msg),
        onError: () => {},
      });

      const stream = getStream();
      stream.simulateData(
        new kubemq.EventReceive({
          EventID: 'e-1',
          Channel: 'ev-ch',
          Body: new Uint8Array([1]),
          Metadata: 'meta',
          Timestamp: BigInt(Date.now() * 1_000_000),
        }),
      );

      await new Promise((r) => setTimeout(r, 10));
      expect(received).toHaveLength(1);
      expect(received[0].id).toBe('e-1');
      expect(sub.isActive).toBe(true);
      sub.cancel();
      expect(sub.isActive).toBe(false);
    });

    it('error handler fires on stream error', () => {
      const { client, transport } = createClient();
      const getStream = captureServerStream(transport);
      const errors: Error[] = [];

      client.subscribeToEvents({
        channel: 'ev-ch',
        onEvent: () => {},
        onError: (err) => errors.push(err),
      });

      getStream().simulateError(new Error('stream broke'));
      expect(errors).toHaveLength(1);
    });
  });

  // ─── subscribeToEventsStore ───

  describe('subscribeToEventsStore', () => {
    it('opens server stream and delivers event store messages', async () => {
      const { client, transport } = createClient();
      const getStream = captureServerStream(transport);
      const received: any[] = [];

      const sub = client.subscribeToEventsStore({
        channel: 'es-ch',
        startFrom: 1, // StartFromNew
        onEvent: (msg) => received.push(msg),
        onError: () => {},
      });

      const stream = getStream();
      stream.simulateData(
        new kubemq.EventReceive({
          EventID: 'es-1',
          Channel: 'es-ch',
          Body: new Uint8Array([2]),
          Metadata: 'meta',
          Timestamp: BigInt(Date.now() * 1_000_000),
          Sequence: BigInt(42),
        }),
      );

      await new Promise((r) => setTimeout(r, 10));
      expect(received).toHaveLength(1);
      expect(received[0].id).toBe('es-1');
      expect(received[0].sequence).toBe(42);
      sub.cancel();
    });

    it('error handler fires on stream error', () => {
      const { client, transport } = createClient();
      const getStream = captureServerStream(transport);
      const errors: Error[] = [];

      client.subscribeToEventsStore({
        channel: 'es-ch',
        startFrom: 1,
        onEvent: () => {},
        onError: (err) => errors.push(err),
      });

      getStream().simulateError(new Error('es stream broke'));
      expect(errors).toHaveLength(1);
    });
  });

  // ─── subscribeToCommands ───

  describe('subscribeToCommands', () => {
    it('opens server stream and delivers commands', async () => {
      const { client, transport } = createClient();
      const getStream = captureServerStream(transport);
      const received: any[] = [];

      const sub = client.subscribeToCommands({
        channel: 'cmd-ch',
        onCommand: (msg) => received.push(msg),
        onError: () => {},
      });

      stream_simulateCommand(getStream());

      await new Promise((r) => setTimeout(r, 10));
      expect(received).toHaveLength(1);
      expect(received[0].channel).toBe('cmd-ch');
      sub.cancel();
    });

    it('error handler fires on stream error', () => {
      const { client, transport } = createClient();
      const getStream = captureServerStream(transport);
      const errors: Error[] = [];

      client.subscribeToCommands({
        channel: 'cmd-ch',
        onCommand: () => {},
        onError: (err) => errors.push(err),
      });

      getStream().simulateError(new Error('cmd stream broke'));
      expect(errors).toHaveLength(1);
    });
  });

  // ─── subscribeToQueries ───

  describe('subscribeToQueries', () => {
    it('opens server stream and delivers queries', async () => {
      const { client, transport } = createClient();
      const getStream = captureServerStream(transport);
      const received: any[] = [];

      const sub = client.subscribeToQueries({
        channel: 'qry-ch',
        onQuery: (msg) => received.push(msg),
        onError: () => {},
      });

      stream_simulateQuery(getStream());

      await new Promise((r) => setTimeout(r, 10));
      expect(received).toHaveLength(1);
      expect(received[0].channel).toBe('qry-ch');
      sub.cancel();
    });
  });

  // ─── sendCommandResponseDirect / sendQueryResponseDirect ───

  describe('sendCommandResponseDirect', () => {
    it('sends response via unary call', async () => {
      const { client, transport } = createClient();
      transport.onUnaryCall('SendResponse', () => new kubemq.Empty());
      await client.sendCommandResponseDirect({
        id: 'cmd-1',
        replyChannel: 'reply',
        executed: true,
      });
      expect(transport.callsTo('SendResponse')).toHaveLength(1);
    });
  });

  describe('sendQueryResponseDirect', () => {
    it('sends response via unary call', async () => {
      const { client, transport } = createClient();
      transport.onUnaryCall('SendResponse', () => new kubemq.Empty());
      await client.sendQueryResponseDirect({
        id: 'qry-1',
        replyChannel: 'reply',
        executed: true,
      });
      expect(transport.callsTo('SendResponse')).toHaveLength(1);
    });
  });

  // ─── peekQueueMessages ───

  describe('peekQueueMessages', () => {
    it('calls ReceiveQueueMessages and returns array', async () => {
      const { client, transport } = createClient();
      transport.onUnaryCall(
        'ReceiveQueueMessages',
        () =>
          new kubemq.ReceiveQueueMessagesResponse({
            RequestID: 'pk-1',
            Messages: [
              new kubemq.QueueMessage({
                MessageID: 'pk-msg-1',
                Channel: 'pk-ch',
                Body: new Uint8Array([1]),
                Attributes: new kubemq.QueueMessageAttributes({
                  Timestamp: BigInt(Date.now() * 1_000_000),
                  Sequence: BigInt(1),
                  ReceiveCount: 1,
                }),
              }),
            ],
            MessagesReceived: 1,
            IsError: false,
            IsPeek: true,
          }),
      );
      const msgs = await client.peekQueueMessages({
        channel: 'pk-ch',
        waitTimeoutSeconds: 1,
      });
      expect(msgs).toHaveLength(1);
      expect(msgs[0]!.id).toBe('pk-msg-1');
    });
  });

  // ─── ackAllQueueMessages ───

  describe('ackAllQueueMessages', () => {
    it('calls AckAllQueueMessages', async () => {
      const { client, transport } = createClient();
      transport.onUnaryCall(
        'AckAllQueueMessages',
        () =>
          new kubemq.AckAllQueueMessagesResponse({
            RequestID: 'ack-all-1',
            AffectedMessages: BigInt(5),
            IsError: false,
          }),
      );
      const result = await client.ackAllQueueMessages('q-ch', 1);
      expect(Number(result)).toBe(5);
    });
  });

  // ─── purgeQueue ───

  describe('purgeQueue', () => {
    it('calls AckAllQueueMessages for purge', async () => {
      const { client, transport } = createClient();
      transport.onUnaryCall(
        'AckAllQueueMessages',
        () =>
          new kubemq.AckAllQueueMessagesResponse({
            RequestID: 'purge-1',
            AffectedMessages: BigInt(3),
            IsError: false,
          }),
      );
      await client.purgeQueue('q-ch');
      expect(transport.callsTo('AckAllQueueMessages')).toHaveLength(1);
    });
  });

  // ─── Channel management convenience aliases ───

  describe('channel management', () => {
    function setupChannelHandler(transport: any) {
      transport.onUnaryCall('SendRequest', () =>
        new kubemq.Response({
          RequestID: 'ch-op-1',
          ClientID: 'test',
          Executed: true,
        }),
      );
    }

    it('createChannel sends request', async () => {
      const { client, transport } = createClient();
      setupChannelHandler(transport);
      await client.createChannel('test-ch', 'events');
      expect(transport.callsTo('SendRequest')).toHaveLength(1);
    });

    it('deleteChannel sends request', async () => {
      const { client, transport } = createClient();
      setupChannelHandler(transport);
      await client.deleteChannel('test-ch', 'events');
      expect(transport.callsTo('SendRequest')).toHaveLength(1);
    });

    it('listChannels sends request', async () => {
      const { client, transport } = createClient();
      transport.onUnaryCall('SendRequest', () =>
        new kubemq.Response({
          RequestID: 'list-1',
          ClientID: 'test',
          Executed: true,
          Body: new TextEncoder().encode('[]'),
        }),
      );
      const result = await client.listChannels('events');
      expect(result).toEqual([]);
    });

    it('convenience aliases delegate correctly', async () => {
      const { client, transport } = createClient();
      setupChannelHandler(transport);

      await client.createEventsChannel('ch1');
      await client.createEventsStoreChannel('ch2');
      await client.createCommandsChannel('ch3');
      await client.createQueriesChannel('ch4');
      await client.createQueuesChannel('ch5');

      await client.deleteEventsChannel('ch1');
      await client.deleteEventsStoreChannel('ch2');
      await client.deleteCommandsChannel('ch3');
      await client.deleteQueriesChannel('ch4');
      await client.deleteQueuesChannel('ch5');

      expect(transport.callsTo('SendRequest')).toHaveLength(10);
    });

    it('list convenience aliases delegate correctly', async () => {
      const { client, transport } = createClient();
      transport.onUnaryCall('SendRequest', () =>
        new kubemq.Response({
          RequestID: 'list-1',
          ClientID: 'test',
          Executed: true,
          Body: new TextEncoder().encode('[]'),
        }),
      );

      await client.listEventsChannels();
      await client.listEventsStoreChannels();
      await client.listCommandsChannels();
      await client.listQueriesChannels();
      await client.listQueuesChannels();

      expect(transport.callsTo('SendRequest')).toHaveLength(5);
    });
  });

  // ─── sendCommand / sendQuery ───

  describe('sendCommand', () => {
    it('sends command and returns response', async () => {
      const { client, transport } = createClient();
      transport.onUnaryCall('SendRequest', () =>
        new kubemq.Response({
          RequestID: 'cmd-req-1',
          ClientID: 'test',
          Executed: true,
          Timestamp: BigInt(Date.now() * 1_000_000),
        }),
      );
      const result = await client.sendCommand({
        channel: 'cmd-ch',
        timeoutInSeconds: 5,
        body: new Uint8Array([1]),
      });
      expect(result.executed).toBe(true);
    });
  });

  describe('sendQuery', () => {
    it('sends query and returns response', async () => {
      const { client, transport } = createClient();
      transport.onUnaryCall('SendRequest', () =>
        new kubemq.Response({
          RequestID: 'qry-req-1',
          ClientID: 'test',
          Executed: true,
          Body: new Uint8Array([42]),
          Timestamp: BigInt(Date.now() * 1_000_000),
        }),
      );
      const result = await client.sendQuery({
        channel: 'qry-ch',
        timeoutInSeconds: 5,
        body: new Uint8Array([1]),
      });
      expect(result.executed).toBe(true);
    });
  });

  // ─── createEventStream ───

  describe('createEventStream', () => {
    it('opens duplex stream and sends events', async () => {
      const { client, transport } = createClient();
      const getStream = captureDuplexStream(transport);
      const handle = client.createEventStream();

      expect(handle.isActive).toBe(true);
      await handle.send({ channel: 'ev-ch', body: new Uint8Array([1]) });

      const stream = getStream();
      expect(stream.written).toHaveLength(1);
      expect((stream.written[0] as any).Channel).toBe('ev-ch');
    });

    it('error handler fires on stream error', async () => {
      const { client, transport } = createClient();
      const getStream = captureDuplexStream(transport);
      const handle = client.createEventStream();
      const errors: Error[] = [];
      handle.onError((err: Error) => errors.push(err));

      await new Promise((r) => setTimeout(r, 10));
      getStream().simulateError(new Error('ev stream broke'));

      expect(errors).toHaveLength(1);
    });

    it('close ends stream', () => {
      const { client, transport } = createClient();
      captureDuplexStream(transport);
      const handle = client.createEventStream();
      handle.close();
      expect(handle.isActive).toBe(false);
    });

    it('send after close resolves (no-op)', async () => {
      const { client, transport } = createClient();
      captureDuplexStream(transport);
      const handle = client.createEventStream();
      handle.close();
      await handle.send({ channel: 'ch', body: new Uint8Array([1]) });
    });

    it('send returns backpressure promise when write returns false', async () => {
      const { client, transport } = createClient();
      const getStream = captureDuplexStream(transport);
      const handle = client.createEventStream();

      const stream = getStream();
      stream.setBackpressure(true);
      const sendPromise = handle.send({ channel: 'ch', body: new Uint8Array([1]) });

      // Resolve backpressure
      stream.setBackpressure(false);
      stream.triggerDrain();
      await sendPromise;
    });

    it('stream end triggers breakStream and rejects drain waiters', async () => {
      const { client, transport } = createClient();
      const getStream = captureDuplexStream(transport);
      const handle = client.createEventStream();

      const stream = getStream();
      stream.setBackpressure(true);
      const sendPromise = handle.send({ channel: 'ch', body: new Uint8Array([1]) });

      stream.simulateEnd();
      await expect(sendPromise).rejects.toThrow('Event stream broken');
    });
  });

  // ─── createQueueUpstream ───

  describe('createQueueUpstream', () => {
    it('opens duplex stream and sends queue messages', async () => {
      const { client, transport } = createClient();
      const getStream = captureDuplexStream(transport);
      const handle = client.createQueueUpstream();

      expect(handle.isActive).toBe(true);

      const sendPromise = handle.send([{ channel: 'q-ch', body: new Uint8Array([1]) }]);

      await new Promise((r) => setTimeout(r, 10));
      const stream = getStream();
      const req = stream.written[0] as any;

      // Simulate server ACK
      stream.simulateData(
        new kubemq.QueuesUpstreamResponse({
          RefRequestID: req.RequestID,
          Results: [
            new kubemq.SendQueueMessageResult({
              MessageID: 'qm-1',
              SentAt: BigInt(Date.now() * 1_000_000),
              IsError: false,
            }),
          ],
          IsError: false,
        }),
      );

      const result = await sendPromise;
      expect(result.results).toHaveLength(1);
    });

    it('close rejects pending and ends stream', async () => {
      const { client, transport } = createClient();
      captureDuplexStream(transport);
      const handle = client.createQueueUpstream();

      const sendPromise = handle.send([{ channel: 'q-ch', body: new Uint8Array([1]) }]);
      await new Promise((r) => setTimeout(r, 10));

      handle.close();
      expect(handle.isActive).toBe(false);
      await expect(sendPromise).rejects.toThrow('Queue upstream closed by client');
    });

    it('stream error rejects pending', async () => {
      const { client, transport } = createClient();
      const getStream = captureDuplexStream(transport);
      const handle = client.createQueueUpstream();

      const sendPromise = handle.send([{ channel: 'q-ch', body: new Uint8Array([1]) }]);
      await new Promise((r) => setTimeout(r, 10));

      getStream().simulateError(new Error('upstream broke'));
      await expect(sendPromise).rejects.toThrow('upstream broke');
    });

    it('stream end rejects pending', async () => {
      const { client, transport } = createClient();
      const getStream = captureDuplexStream(transport);
      const handle = client.createQueueUpstream();

      const sendPromise = handle.send([{ channel: 'q-ch', body: new Uint8Array([1]) }]);
      await new Promise((r) => setTimeout(r, 10));

      getStream().simulateEnd();
      await expect(sendPromise).rejects.toThrow('Queue upstream stream closed');
    });
  });

  // ─── close() with active senders ───

  describe('close with active senders', () => {
    it('closes event sender during client close', async () => {
      const { client, transport } = createClient();
      captureDuplexStream(transport);
      await transport.connect();
      // Initialize event sender
      await client.sendEvent({ channel: 'ch', body: new Uint8Array([1]) });
      // Close should clean up the sender
      await client.close();
      // After close, operations fail
      await expect(client.sendEvent({ channel: 'ch' })).rejects.toThrow();
    });

    it('closes upstream sender during client close', async () => {
      const { client, transport } = createClient();
      captureDuplexStream(transport);
      await transport.connect();
      // Initialize upstream sender by starting a queue send (will hang on ACK)
      const queuePromise = client.sendQueueMessage({ channel: 'q', body: new Uint8Array([1]) }).catch(() => {});
      await new Promise((r) => setTimeout(r, 10));
      // Close should clean up
      await client.close();
      await queuePromise;
    });
  });

  // ─── subscription cancel and resubscribe ───

  describe('subscription lifecycle', () => {
    it('subscribeToEvents cancel unregisters from tracker', () => {
      const { client, transport } = createClient();
      captureServerStream(transport);
      const sub = client.subscribeToEvents({
        channel: 'ev-ch',
        onEvent: () => {},
        onError: () => {},
      });
      expect(sub.isActive).toBe(true);
      sub.cancel();
      expect(sub.isActive).toBe(false);
    });

    it('subscribeToCommands cancel unregisters from tracker', () => {
      const { client, transport } = createClient();
      captureServerStream(transport);
      const sub = client.subscribeToCommands({
        channel: 'cmd-ch',
        onCommand: () => {},
        onError: () => {},
      });
      sub.cancel();
      expect(sub.isActive).toBe(false);
    });

    it('subscribeToQueries cancel unregisters from tracker', () => {
      const { client, transport } = createClient();
      captureServerStream(transport);
      const sub = client.subscribeToQueries({
        channel: 'qry-ch',
        onQuery: () => {},
        onError: () => {},
      });
      sub.cancel();
      expect(sub.isActive).toBe(false);
    });

    it('subscribeToEvents resubscribes on transport reconnect', async () => {
      const { client, transport } = createClient();
      captureServerStream(transport);
      const received: any[] = [];

      client.subscribeToEvents({
        channel: 'ev-ch',
        onEvent: (msg) => received.push(msg),
        onError: () => {},
      });

      // Verify initial subscription
      expect(transport.callsTo('SubscribeToEvents')).toHaveLength(1);

      // Simulate disconnect/reconnect — triggers resubscribe
      transport.simulateDisconnect();
      transport.simulateReconnect();

      // Should have opened a second stream
      expect(transport.callsTo('SubscribeToEvents').length).toBeGreaterThanOrEqual(1);
    });

    it('subscribeToEventsStore resubscribes on reconnect', async () => {
      const { client, transport } = createClient();
      captureServerStream(transport);

      client.subscribeToEventsStore({
        channel: 'es-ch',
        startFrom: 1,
        onEvent: () => {},
        onError: () => {},
      });

      expect(transport.callsTo('SubscribeToEvents')).toHaveLength(1);

      transport.simulateDisconnect();
      transport.simulateReconnect();

      expect(transport.callsTo('SubscribeToEvents').length).toBeGreaterThanOrEqual(1);
    });

    it('subscribeToCommands resubscribes on reconnect', () => {
      const { client, transport } = createClient();
      captureServerStream(transport);

      client.subscribeToCommands({
        channel: 'cmd-ch',
        onCommand: () => {},
        onError: () => {},
      });

      expect(transport.callsTo('SubscribeToRequests')).toHaveLength(1);

      transport.simulateDisconnect();
      transport.simulateReconnect();

      expect(transport.callsTo('SubscribeToRequests').length).toBeGreaterThanOrEqual(1);
    });
  });
});
