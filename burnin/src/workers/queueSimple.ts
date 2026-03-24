/**
 * Queue Simple worker: sendQueueMessage() + receiveQueueMessages() with auto-ack.
 * v2: channelName, rate, channelIndex passed in; worker IDs include channel index.
 */
import type { KubeMQClient } from 'kubemq-js';
import { createQueueMessage } from 'kubemq-js';
import { BaseWorker } from './base.js';
import * as mc from '../metrics.js';
import * as payload from '../payload.js';
import type { Config, PatternConfig } from '../config.js';

const SDK = 'js',
  PATTERN = 'queue_simple';

export class QueueSimpleWorker extends BaseWorker {
  private client: KubeMQClient | null = null;
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
    this.client = client;
    const chIdx = String(this.channelIndex).padStart(4, '0');
    for (let i = 0; i < this.numConsumers; i++) {
      const consumerId = `c-${PATTERN}-${chIdx}-${String(i).padStart(3, '0')}`;
      this.runConsumer(consumerId, client);
    }
    mc.setActiveConnections(PATTERN, 1);
    console.log(`queue_simple consumers started on ${this.channelName}`);
  }

  startProducers(client: KubeMQClient): void {
    const chIdx = String(this.channelIndex).padStart(4, '0');
    for (let i = 0; i < this.numProducers; i++) {
      const producerId = `p-${PATTERN}-${chIdx}-${String(i).padStart(3, '0')}`;
      this.runProducer(producerId, client);
    }
    console.log(`queue_simple producers started on ${this.channelName}`);
  }

  private async runConsumer(consumerId: string, client: KubeMQClient): Promise<void> {
    const signal = this.consumerAbort.signal;
    // Cap poll timeout at 1s for queue_simple to avoid latency spikes from long-polling
    const pollTimeout = Math.min(this.cfg.queue.poll_wait_timeout_seconds, 1);
    while (!signal.aborted) {
      try {
        const messages = await client.receiveQueueMessages({
          channel: this.channelName,
          maxMessages: this.cfg.queue.poll_max_messages,
          waitTimeoutSeconds: pollTimeout,
          autoAck: true,
        }, {
          timeout: (pollTimeout + 2) * 1000, // Coordinate client timeout with server poll timeout
        });
        if (!messages || messages.length === 0) continue;
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
      } catch (e: any) {
        if (signal.aborted) break;
        if (!e.message?.includes('timeout')) this.recordError('receive_failure');
        await delay(1000);
      }
    }
  }

  private async runProducer(producerId: string, client: KubeMQClient): Promise<void> {
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
        await client.sendQueueMessage(
          createQueueMessage({
            channel: this.channelName,
            body,
            tags: { content_hash: crcHex },
          }),
        );
        mc.observeSendDuration(PATTERN, (performance.now() - t0) / 1000);
        this.recordSend(producerId, seq, body.length, true);
      } catch (e) {
        this.recordError('send_failure');
      }
    }
  }

  stopConsumers(): void {
    mc.setActiveConnections(PATTERN, 0);
    super.stopConsumers();
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
