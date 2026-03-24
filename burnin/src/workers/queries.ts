/**
 * Queries worker: RPC request/response via sendQuery() + subscribeToQueries().
 * v2: channelName, rate, channelIndex passed in; worker IDs include channel index.
 */
import type { KubeMQClient, Subscription } from 'kubemq-js';
import { createQuery } from 'kubemq-js';
import { BaseWorker } from './base.js';
import * as mc from '../metrics.js';
import * as payload from '../payload.js';
import type { Config, PatternConfig } from '../config.js';

const SDK = 'js',
  PATTERN = 'queries';

/** Max concurrent RPCs in-flight per sender goroutine. */
const SENDER_CONCURRENCY = 16;

export class QueriesWorker extends BaseWorker {
  private subscriptions: Subscription[] = [];
  private readonly numSenders: number;
  private readonly numResponders: number;

  constructor(
    cfg: Config,
    runId: string,
    channelName: string,
    channelIndex: number,
    patternCfg: PatternConfig,
  ) {
    super(PATTERN, cfg, channelName, patternCfg.rate, channelIndex);
    this.numSenders = patternCfg.senders_per_channel;
    this.numResponders = patternCfg.responders_per_channel;
  }

  startConsumers(client: KubeMQClient): void {
    const chIdx = String(this.channelIndex).padStart(4, '0');
    for (let i = 0; i < this.numResponders; i++) {
      const sub = client.subscribeToQueries(
        {
          channel: this.channelName,
          onQuery: async (query) => {
            const tags = query.tags ?? {};
            const isWarmup = tags.warmup === 'true';
            try {
              await client.sendQueryResponseDirect({
                id: query.id,
                replyChannel: query.replyChannel,
                executed: true,
                body: isWarmup ? undefined : query.body,
              });
            } catch (e) {
              if (!isWarmup) this.recordError('response_send_failure');
            }
          },
          onError: (err) => {
            console.error(`queries subscription error (ch ${chIdx}): ${err.message}`);
            this.recordError('subscription_error');
            this.incReconnection();
          },
        },
        { signal: this.consumerAbort.signal },
      );
      this.subscriptions.push(sub);
    }
    mc.setActiveConnections(PATTERN, 1);
    console.log(`queries responders started on ${this.channelName}`);
  }

  startProducers(client: KubeMQClient): void {
    const chIdx = String(this.channelIndex).padStart(4, '0');
    for (let i = 0; i < this.numSenders; i++) {
      const senderId = `s-${PATTERN}-${chIdx}-${String(i).padStart(3, '0')}`;
      this.runSender(senderId, client);
    }
    console.log(`queries senders started on ${this.channelName}`);
  }

  private async runSender(senderId: string, client: KubeMQClient): Promise<void> {
    let seq = 0;
    const signal = this.producerAbort.signal;
    const timeoutInSeconds = this.cfg.rpc.timeout_ms / 1000;
    const inflight = new Set<Promise<void>>();

    while (!signal.aborted) {
      if (!(await this.limiter.wait(signal))) break;
      if (signal.aborted) break;

      seq++;
      const curSeq = seq;
      const size = this.messageSize();
      const { body, crcHex } = payload.encode(SDK, PATTERN, senderId, curSeq, size);

      const task = (async () => {
        try {
          const t0 = performance.now();
          const resp = await client.sendQuery(
            createQuery({
              channel: this.channelName,
              body,
              timeoutInSeconds,
              tags: { content_hash: crcHex },
            }),
          );
          const rpcDuration = (performance.now() - t0) / 1000;
          this.rpcLatencyAccum.record(rpcDuration);
          if (this.patternLatencyAccum) {
            this.patternLatencyAccum.record(rpcDuration);
          }
          mc.observeRpcDuration(PATTERN, rpcDuration);

          if (resp.error) {
            if (resp.error.toLowerCase().includes('timeout')) this.incRpcTimeout();
            else this.incRpcError();
          } else {
            this.incRpcSuccess();
            this.recordSend(senderId, curSeq, body.length, true);
            if (resp.body && resp.body.length > 0) {
              if (payload.verifyCrc(resp.body, crcHex)) {
                mc.incReceived(PATTERN, senderId, resp.body.length);
              } else {
                this.corrupted++;
                mc.incCorrupted(PATTERN);
              }
            }
          }
        } catch (e: any) {
          if (e.message?.toLowerCase().includes('timeout')) this.incRpcTimeout();
          else this.incRpcError();
          this.recordError('send_failure');
        }
      })();

      inflight.add(task);
      task.finally(() => inflight.delete(task));

      if (inflight.size >= SENDER_CONCURRENCY) {
        await Promise.race(inflight);
      }
    }

    // Drain remaining in-flight RPCs
    await Promise.allSettled(inflight);
  }

  stopConsumers(): void {
    for (const sub of this.subscriptions) sub.cancel();
    mc.setActiveConnections(PATTERN, 0);
    super.stopConsumers();
  }
}
