/**
 * Events Store worker: persistent pub/sub via createEventStoreStream() + subscribeToEventsStore().
 * v2: channelName, rate, channelIndex passed in; worker IDs include channel index.
 */
import type { KubeMQClient, Subscription, EventStoreStreamHandle } from 'kubemq-js';
import { createEventStoreMessage, EventStoreStartPosition } from 'kubemq-js';
import { BaseWorker } from './base.js';
import * as mc from '../metrics.js';
import * as payload from '../payload.js';
import type { Config, PatternConfig } from '../config.js';

const SDK = 'js',
  PATTERN = 'events_store';

export class EventsStoreWorker extends BaseWorker {
  private subscriptions: Subscription[] = [];
  private streamHandle: EventStoreStreamHandle | null = null;
  private readonly numProducers: number;
  private readonly numConsumers: number;
  private readonly useGroup: boolean;
  private readonly runId: string;

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
    this.useGroup = patternCfg.consumer_group;
    this.runId = runId;
  }

  startConsumers(client: KubeMQClient): void {
    const chIdx = String(this.channelIndex).padStart(4, '0');
    for (let i = 0; i < this.numConsumers; i++) {
      const consumerId = `c-${PATTERN}-${chIdx}-${String(i).padStart(3, '0')}`;
      const group = this.useGroup ? `js_burnin_${this.runId}_${PATTERN}_${chIdx}_group` : '';
      const sub = client.subscribeToEventsStore(
        {
          channel: this.channelName,
          group,
          startFrom: EventStoreStartPosition.StartFromNew,
          onEvent: (event) => {
            const tags = event.tags ?? {};
            if (tags.warmup === 'true') return;
            try {
              const msg = payload.decode(event.body);
              this.recordReceive(
                consumerId,
                event.body,
                tags.content_hash ?? '',
                msg.producer_id,
                msg.sequence,
              );
            } catch {
              this.recordError('decode_failure');
            }
          },
          onError: (err) => {
            console.error(`events_store subscription error (ch ${chIdx}): ${err.message}`);
            this.recordError('subscription_error');
            this.incReconnection();
          },
        },
        { signal: this.consumerAbort.signal },
      );
      this.subscriptions.push(sub);
    }
    mc.setActiveConnections(PATTERN, 1);
    console.log(`events_store consumers started on ${this.channelName}`);
  }

  startProducers(client: KubeMQClient): void {
    this.streamHandle = client.createEventStoreStream();
    this.streamHandle.onError((err) => {
      console.error(`events_store stream error: ${err.message}`);
      this.recordError('send_failure');
    });

    const chIdx = String(this.channelIndex).padStart(4, '0');
    for (let i = 0; i < this.numProducers; i++) {
      const producerId = `p-${PATTERN}-${chIdx}-${String(i).padStart(3, '0')}`;
      this.runProducer(producerId);
    }
    console.log(`events_store producers started on ${this.channelName}`);
  }

  private async runProducer(producerId: string): Promise<void> {
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
        await this.streamHandle!.send(
          createEventStoreMessage({
            channel: this.channelName,
            body,
            tags: { content_hash: crcHex },
          }),
        );
        mc.observeSendDuration(PATTERN, (performance.now() - t0) / 1000);
        this.recordSend(producerId, seq, body.length, true);
      } catch (e) {
        this.recordError('send_failure');
        mc.incUnconfirmed(PATTERN);
        // JS-1v2: back off on send errors to avoid tight-looping during reconnection
        await delay(200);
      }
    }
  }

  stopProducers(): void {
    this.streamHandle?.close();
    this.streamHandle = null;
    super.stopProducers();
  }

  stopConsumers(): void {
    for (const sub of this.subscriptions) sub.cancel();
    mc.setActiveConnections(PATTERN, 0);
    super.stopConsumers();
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
