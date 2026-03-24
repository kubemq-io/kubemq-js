/**
 * Queue Stream worker: createQueueUpstream() + streamQueueMessages() with batch ackAll.
 * v2: channelName, rate, channelIndex passed in; worker IDs include channel index.
 */
import type { KubeMQClient, QueueUpstreamHandle, QueueStreamHandle } from 'kubemq-js';
import { createQueueMessage } from 'kubemq-js';
import { BaseWorker } from './base.js';
import * as mc from '../metrics.js';
import * as payload from '../payload.js';
import type { Config, PatternConfig } from '../config.js';

const SDK = 'js',
  PATTERN = 'queue_stream';

export class QueueStreamWorker extends BaseWorker {
  private upstreamHandles: QueueUpstreamHandle[] = [];
  private streamHandles: QueueStreamHandle[] = [];
  private readonly numProducers: number;
  private readonly numConsumers: number;

  constructor(
    cfg: Config,
    runId: string,
    channelName: string,
    channelIndex: number,
    patternCfg: PatternConfig,
  ) {
    super(PATTERN, cfg, channelName, patternCfg.rate, channelIndex);
    this.numProducers = patternCfg.producers_per_channel;
    this.numConsumers = patternCfg.consumers_per_channel;
  }

  startConsumers(client: KubeMQClient): void {
    const chIdx = String(this.channelIndex).padStart(4, '0');
    for (let i = 0; i < this.numConsumers; i++) {
      const consumerId = `c-${PATTERN}-${chIdx}-${String(i).padStart(3, '0')}`;
      const handle = client.streamQueueMessages({
        channel: this.channelName,
        waitTimeoutSeconds: this.cfg.queue.poll_wait_timeout_seconds,
        maxMessages: this.cfg.queue.poll_max_messages,
        autoAck: false,
      });

      handle.onMessages((messages) => {
        for (const msg of messages) {
          const tags = msg.tags ?? {};
          if (tags.warmup === 'true') continue;
          try {
            const decoded = payload.decode(msg.body);
            this.recordReceive(
              consumerId,
              msg.body,
              tags.content_hash ?? '',
              decoded.producer_id,
              decoded.sequence,
            );
          } catch {
            this.recordError('decode_failure');
          }
        }
        handle.ackAll();
      });
      handle.onError((err) => {
        console.error(`queue_stream consumer error (ch ${chIdx}): ${err.message}`);
        this.recordError('receive_failure');
        this.incReconnection();
      });
      handle.onClose(() => {
        this.incReconnection();
      });

      this.streamHandles.push(handle);
    }
    mc.setActiveConnections(PATTERN, 1);
    console.log(`queue_stream consumers started on ${this.channelName}`);
  }

  startProducers(client: KubeMQClient): void {
    const chIdx = String(this.channelIndex).padStart(4, '0');
    for (let i = 0; i < this.numProducers; i++) {
      const producerId = `p-${PATTERN}-${chIdx}-${String(i).padStart(3, '0')}`;
      const upstream = client.createQueueUpstream();
      this.upstreamHandles.push(upstream);
      this.runProducer(producerId, upstream);
    }
    console.log(`queue_stream producers started on ${this.channelName}`);
  }

  private async runProducer(producerId: string, upstream: QueueUpstreamHandle): Promise<void> {
    let seq = 0;
    const signal = this.producerAbort.signal;
    while (!signal.aborted) {
      if (!(await this.limiter.wait(signal))) break;
      if (this.backpressureCheck()) {
        await delay(100);
        continue;
      }

      seq++;
      const size = this.messageSize();
      const { body, crcHex } = payload.encode(SDK, PATTERN, producerId, seq, size);

      try {
        const t0 = performance.now();
        this.tsStore.store_ts(producerId, seq); // Record send time BEFORE await for accurate latency
        await upstream.send([
          createQueueMessage({
            channel: this.channelName,
            body,
            tags: { content_hash: crcHex },
          }),
        ]);
        mc.observeSendDuration(PATTERN, (performance.now() - t0) / 1000);
        this.recordSend(producerId, seq, body.length, true);
      } catch (e) {
        this.recordError('send_failure');
      }
    }
  }

  stopProducers(): void {
    for (const h of this.upstreamHandles) h.close();
    this.upstreamHandles = [];
    super.stopProducers();
  }

  stopConsumers(): void {
    for (const h of this.streamHandles) h.close();
    this.streamHandles = [];
    mc.setActiveConnections(PATTERN, 0);
    super.stopConsumers();
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
