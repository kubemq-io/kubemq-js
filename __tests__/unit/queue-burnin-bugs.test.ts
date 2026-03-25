/**
 * Tests for burn-in bugs discovered during 9-hour JS/TS SDK soak test.
 *
 * Bug 1: createQueueUpstream — resubscribe adds listeners without removing old ones (memory leak)
 * Bug 2: streamQueueMessages — resubscribe adds listeners without removing old ones (memory leak)
 * Bug 3: streamQueueMessages — ackAll() calls scheduleRePoll() immediately, racing the broker
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { KubeMQClient } from '../../src/client.js';
import { MockTransport } from '../fixtures/mock-transport.js';
import { applyDefaults } from '../../src/internal/config-defaults.js';
import { kubemq } from '../../src/protos/kubemq.js';

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

/**
 * Captures ALL duplex streams created (not just the last one).
 */
function captureAllDuplexStreams(transport: MockTransport) {
  const streams: Array<{ method: string; stream: any }> = [];
  const origDuplex = transport.duplexStream.bind(transport);
  transport.duplexStream = (...args: any[]) => {
    const s = (origDuplex as any)(...args);
    streams.push({ method: args[0] as string, stream: s });
    return s;
  };
  return {
    all: () => streams,
    forMethod: (m: string) => streams.filter((s) => s.method === m).map((s) => s.stream),
    last: (m?: string) => {
      const filtered = m ? streams.filter((s) => s.method === m) : streams;
      return filtered[filtered.length - 1]?.stream;
    },
  };
}

/**
 * Trigger resubscription on all tracked subscriptions via the transport's
 * SubscriptionTracker — this is what the real GrpcTransport does on reconnect.
 */
function triggerResubscribeAll(transport: MockTransport) {
  transport.getSubscriptionTracker().resubscribeAll();
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ─── Bug 1: createQueueUpstream listener leak on resubscribe ───

describe('Bug 1: createQueueUpstream listener accumulation on resubscribe', () => {
  it('should clean up old stream listeners before attaching new ones on resubscribe', async () => {
    const transport = new MockTransport();
    const { client } = createClient(transport);
    const streams = captureAllDuplexStreams(transport);
    await transport.connect();

    const handle = client.createQueueUpstream();

    const stream1 = streams.last('QueuesUpstream');
    expect(stream1).toBeDefined();

    // Trigger resubscription (what real transport does on reconnect)
    triggerResubscribeAll(transport);

    const allUpstreams = streams.forMethod('QueuesUpstream');
    expect(allUpstreams.length).toBe(2);

    const stream2 = allUpstreams[1];

    // Send a message — write goes to NEW stream
    const sendPromise = handle.send([
      { channel: 'test', body: new Uint8Array([1]) },
    ]);
    expect(stream2.written.length).toBeGreaterThan(0);
    const reqId = (stream2.written[0] as any).RequestID;

    // Resolve via new stream
    stream2.simulateData(
      new kubemq.QueuesUpstreamResponse({
        RefRequestID: reqId,
        Results: [],
        IsError: false,
      }),
    );
    await sendPromise;

    // Now send another message and try to resolve via the OLD stream
    const sendPromise2 = handle.send([
      { channel: 'test2', body: new Uint8Array([2]) },
    ]);
    const reqId2 = (stream2.written[1] as any).RequestID;

    // Simulate response on OLD stream — should NOT resolve if listeners were cleaned up
    stream1.simulateData(
      new kubemq.QueuesUpstreamResponse({
        RefRequestID: reqId2,
        Results: [],
        IsError: false,
      }),
    );

    // Race: if old listeners leaked, promise resolves immediately
    const raceResult = await Promise.race([
      sendPromise2.then(() => 'resolved'),
      new Promise<string>((r) => setTimeout(() => r('pending'), 50)),
    ]);

    // If 'resolved', old stream listeners leaked and processed data via shared pending Map
    expect(raceResult).toBe('pending');

    // Resolve properly via new stream
    stream2.simulateData(
      new kubemq.QueuesUpstreamResponse({
        RefRequestID: reqId2,
        Results: [],
        IsError: false,
      }),
    );
    await sendPromise2;

    handle.close();
  });

  it('should clear pending map on reconnect to prevent dangling promises', async () => {
    const transport = new MockTransport();
    const { client } = createClient(transport);
    captureAllDuplexStreams(transport);
    await transport.connect();

    const handle = client.createQueueUpstream();

    // Send a message that will be "in-flight" during reconnect
    const sendPromise = handle.send([
      { channel: 'test', body: new Uint8Array([1]) },
    ]);

    // Trigger resubscription — in-flight promises should be rejected, not left dangling
    triggerResubscribeAll(transport);

    // The in-flight promise should be rejected (not hang forever)
    await expect(sendPromise).rejects.toThrow();

    handle.close();
  });
});

// ─── Bug 2: streamQueueMessages listener leak on resubscribe ───

describe('Bug 2: streamQueueMessages listener accumulation on resubscribe', () => {
  it('should clean up old stream listeners before attaching new ones on resubscribe', async () => {
    const transport = new MockTransport();
    const { client } = createClient(transport);
    const streams = captureAllDuplexStreams(transport);
    await transport.connect();

    const handle = client.streamQueueMessages({
      channel: 'test-queue',
      waitTimeoutSeconds: 5,
      maxMessages: 10,
    });

    const msgHandler = vi.fn();
    handle.onMessages(msgHandler);

    const stream1 = streams.last('QueuesDownstream');
    expect(stream1).toBeDefined();

    // Trigger resubscription
    triggerResubscribeAll(transport);

    const allDownstreams = streams.forMethod('QueuesDownstream');
    expect(allDownstreams.length).toBe(2);

    const stream2 = allDownstreams[1];

    // Simulate a message on the OLD stream — should NOT trigger handler
    msgHandler.mockClear();
    stream1.simulateData(
      new kubemq.QueuesDownstreamResponse({
        RequestTypeData: 1,
        TransactionId: 'old-txn',
        Messages: [
          new kubemq.QueueMessage({
            MessageID: 'old-msg',
            Channel: 'test-queue',
            Body: new Uint8Array([99]),
          }),
        ],
        IsError: false,
      }),
    );

    // Old listeners leaked if this fires
    expect(msgHandler).not.toHaveBeenCalled();

    // Verify NEW stream works
    stream2.simulateData(
      new kubemq.QueuesDownstreamResponse({
        RequestTypeData: 1,
        TransactionId: 'new-txn',
        Messages: [
          new kubemq.QueueMessage({
            MessageID: 'new-msg',
            Channel: 'test-queue',
            Body: new Uint8Array([1]),
          }),
        ],
        IsError: false,
      }),
    );

    expect(msgHandler).toHaveBeenCalledTimes(1);
    expect(msgHandler.mock.calls[0][0][0].id).toBe('new-msg');

    handle.close();
  });
});

// ─── Bug 3: ackAll() calls scheduleRePoll() immediately (causes duplicates) ───

describe('Bug 3: ackAll() premature scheduleRePoll causing duplicates', () => {
  it('ackAll() should clear activeTransactionId before re-polling', async () => {
    vi.useFakeTimers();
    const transport = new MockTransport();
    const { client } = createClient(transport);
    const streams = captureAllDuplexStreams(transport);
    await transport.connect();

    const handle = client.streamQueueMessages({
      channel: 'test-queue',
      waitTimeoutSeconds: 5,
      maxMessages: 2,
      autoAck: false,
    });

    const stream = streams.last('QueuesDownstream');
    expect(stream).toBeDefined();

    // Deliver a batch of 2 messages
    stream.simulateData(
      new kubemq.QueuesDownstreamResponse({
        RequestTypeData: 1,
        TransactionId: 'txn-1',
        Messages: [
          new kubemq.QueueMessage({
            MessageID: 'msg-1',
            Channel: 'test-queue',
            Body: new Uint8Array([1]),
            Attributes: new kubemq.QueueMessageAttributes({ Sequence: 1 }),
          }),
          new kubemq.QueueMessage({
            MessageID: 'msg-2',
            Channel: 'test-queue',
            Body: new Uint8Array([2]),
            Attributes: new kubemq.QueueMessageAttributes({ Sequence: 2 }),
          }),
        ],
        IsError: false,
      }),
    );

    const writesBefore = stream.written.length;

    // Call ackAll
    handle.ackAll();

    // Flush the setTimeout(0) used by scheduleRePoll
    await vi.advanceTimersByTimeAsync(1);

    const newWrites = stream.written.slice(writesBefore);
    expect(newWrites.length).toBe(2);

    const ackWrite = newWrites[0] as any;
    const rePollWrite = newWrites[1] as any;

    // The AckAll should reference the transaction
    expect(ackWrite.RequestTypeData).toBe(2);
    expect(ackWrite.RefTransactionId).toBe('txn-1');

    // The re-poll should NOT reference the old transaction
    expect(rePollWrite.RefTransactionId).toBeFalsy();

    handle.close();
    vi.useRealTimers();
  });

  it('ackAll() should not trigger double re-poll via onMessageSettled path', async () => {
    vi.useFakeTimers();
    const transport = new MockTransport();
    const { client } = createClient(transport);
    const streams = captureAllDuplexStreams(transport);
    await transport.connect();

    const handle = client.streamQueueMessages({
      channel: 'test-queue',
      waitTimeoutSeconds: 5,
      maxMessages: 1,
      autoAck: false,
    });

    const msgHandler = vi.fn();
    handle.onMessages(msgHandler);

    const stream = streams.last('QueuesDownstream');

    // Deliver one message
    stream.simulateData(
      new kubemq.QueuesDownstreamResponse({
        RequestTypeData: 1,
        TransactionId: 'txn-2',
        Messages: [
          new kubemq.QueueMessage({
            MessageID: 'msg-solo',
            Channel: 'test-queue',
            Body: new Uint8Array([1]),
            Attributes: new kubemq.QueueMessageAttributes({ Sequence: 1 }),
          }),
        ],
        IsError: false,
      }),
    );

    expect(msgHandler).toHaveBeenCalledTimes(1);
    const writesBefore = stream.written.length;

    // Call ackAll then also individual ack — should NOT double re-poll
    handle.ackAll();
    const msg = msgHandler.mock.calls[0][0][0];
    msg.ack();

    // Flush all timers
    await vi.advanceTimersByTimeAsync(10);

    const newWrites = stream.written.slice(writesBefore);

    // Count all new writes and verify only 1 re-poll (Get request with RequestTypeData=1)
    // ackAll() writes: AckAll (type 2) + scheduleRePoll (type 1)
    // msg.ack() should be a no-op since bulkSettled is true
    const ackAllWrites = newWrites.filter((w: any) => w.RequestTypeData === 2);
    const rePollWrites = newWrites.filter((w: any) => w.RequestTypeData === 1);

    expect(ackAllWrites.length).toBe(1); // exactly one AckAll
    // Should only re-poll ONCE (from ackAll), not twice (ackAll + onMessageSettled)
    expect(rePollWrites.length).toBe(1);

    handle.close();
    vi.useRealTimers();
  });
});
