/**
 * BaseWorker: shared state, counters, 2-phase shutdown via AbortController, dual tracking.
 * v2: accepts channelName, rate, channelIndex; dual-write latency to per-channel + pattern-level accumulator.
 */
import * as mc from '../metrics.js';
import { verifyCrc, SizeDistribution } from '../payload.js';
import { RateLimiter } from '../rateLimiter.js';
import { TimestampStore } from '../timestampStore.js';
import { Tracker } from '../tracker.js';
import { PeakRateTracker, SlidingRateTracker, LatencyAccumulator } from '../peakRate.js';
import type { Config } from '../config.js';

export abstract class BaseWorker {
  readonly pattern: string;
  readonly cfg: Config;
  readonly channelName: string;
  readonly channelIndex: number;

  // 2-phase shutdown
  protected producerAbort = new AbortController();
  protected consumerAbort = new AbortController();

  // Tracking (per-channel, independent)
  readonly tracker: Tracker;
  readonly latencyAccum = new LatencyAccumulator();
  readonly rpcLatencyAccum = new LatencyAccumulator();
  readonly peakRate = new PeakRateTracker();
  readonly slidingRate = new SlidingRateTracker();
  readonly tsStore = new TimestampStore();

  // Pattern-level shared latency accumulator (dual-write)
  patternLatencyAccum: LatencyAccumulator | null = null;

  // Rate limiting
  protected limiter: RateLimiter;
  protected sizeDist: SizeDistribution | null;

  // In-process counters (dual tracking)
  sent = 0;
  received = 0;
  corrupted = 0;
  errors = 0;
  reconnections = 0;
  rpcSuccess = 0;
  rpcTimeout = 0;
  rpcError = 0;

  // Downtime
  private downtimeStart: number | null = null;
  private downtimeTotal = 0;

  // Reconnection duplicate cooldown
  private recentlyReconnected = false;
  private reconnDupCooldown = 0;

  // CRC sampling: verify every Nth message
  private crcSampleCounter = 0;
  private static readonly CRC_SAMPLE_RATE = 100;

  // Backpressure warning
  private backpressureLogged = false;

  // Per-consumer message counts for group balance
  readonly consumerCounts = new Map<string, number>();

  constructor(pattern: string, cfg: Config, channelName: string, rate: number, channelIndex = 0) {
    this.pattern = pattern;
    this.cfg = cfg;
    this.channelName = channelName;
    this.channelIndex = channelIndex;
    this.tracker = new Tracker(cfg.message.reorder_window);
    this.limiter = new RateLimiter(rate);
    this.sizeDist =
      cfg.message.size_mode === 'distribution'
        ? new SizeDistribution(cfg.message.size_distribution)
        : null;
  }

  messageSize(): number {
    return this.sizeDist ? this.sizeDist.selectSize() : this.cfg.message.size_bytes;
  }

  backpressureCheck(): boolean {
    const lag = this.sent - this.received;
    const active = lag > this.cfg.queue.max_depth;
    if (active && !this.backpressureLogged) {
      console.warn(
        `WARNING: ${this.pattern} ch${String(this.channelIndex).padStart(4, '0')} producer paused — lag ${lag} exceeds max_depth ${this.cfg.queue.max_depth}`,
      );
      this.backpressureLogged = true;
    }
    if (!active) this.backpressureLogged = false;
    return active;
  }

  // Recording methods
  recordSend(producerId: string, seq: number, byteCount = 0, skipTimestamp = false): void {
    this.sent++;
    if (!skipTimestamp) this.tsStore.store_ts(producerId, seq);
    this.peakRate.record();
    this.slidingRate.record();
    mc.incSent(this.pattern, producerId, byteCount);
  }

  recordReceive(
    consumerId: string,
    body: Uint8Array,
    crcTag: string,
    producerId: string,
    seq: number,
  ): void {
    this.crcSampleCounter++;
    if (this.crcSampleCounter % BaseWorker.CRC_SAMPLE_RATE === 0) {
      if (!verifyCrc(body, crcTag)) {
        this.corrupted++;
        mc.incCorrupted(this.pattern);
        return;
      }
    }

    const { isDuplicate, isOutOfOrder } = this.tracker.record(producerId, seq);
    if (isDuplicate) {
      mc.incDuplicated(this.pattern);
      if (this.recentlyReconnected) {
        mc.incReconnDuplicates(this.pattern);
        if (++this.reconnDupCooldown >= 100) {
          this.recentlyReconnected = false;
          this.reconnDupCooldown = 0;
        }
      }
      return;
    }

    // Only count non-duplicate deliveries
    this.received++;
    this.consumerCounts.set(consumerId, (this.consumerCounts.get(consumerId) ?? 0) + 1);
    mc.incReceived(this.pattern, consumerId, body.length);
    if (isOutOfOrder) mc.incOutOfOrder(this.pattern);

    const sendTime = this.tsStore.loadAndDelete(producerId, seq);
    if (sendTime !== undefined) {
      const latency = Number(process.hrtime.bigint() - sendTime) / 1e9;
      // Dual-write: per-channel + pattern-level accumulator
      this.latencyAccum.record(latency);
      if (this.patternLatencyAccum) {
        this.patternLatencyAccum.record(latency);
      }
      mc.observeLatency(this.pattern, latency);
    }
  }

  recordError(errorType: string): void {
    this.errors++;
    mc.incError(this.pattern, errorType);
  }

  incReconnection(): void {
    this.reconnections++;
    this.recentlyReconnected = true;
    this.reconnDupCooldown = 0;
    mc.incReconnections(this.pattern);
  }

  incRpcSuccess(): void {
    this.rpcSuccess++;
    mc.incRpcResponse(this.pattern, 'success');
  }
  incRpcTimeout(): void {
    this.rpcTimeout++;
    mc.incRpcResponse(this.pattern, 'timeout');
  }
  incRpcError(): void {
    this.rpcError++;
    mc.incRpcResponse(this.pattern, 'error');
  }

  startDowntime(): void {
    if (this.downtimeStart === null) this.downtimeStart = Date.now();
  }
  stopDowntime(): void {
    if (this.downtimeStart !== null) {
      this.downtimeTotal += (Date.now() - this.downtimeStart) / 1000;
      this.downtimeStart = null;
    }
  }
  get downtimeSeconds(): number {
    let t = this.downtimeTotal;
    if (this.downtimeStart !== null) t += (Date.now() - this.downtimeStart) / 1000;
    return t;
  }

  // Lifecycle
  abstract startConsumers(client: any): void;
  abstract startProducers(client: any): void;

  stopProducers(): void {
    this.producerAbort.abort();
  }
  stopConsumers(): void {
    this.consumerAbort.abort();
  }

  resetAfterWarmup(): void {
    this.sent = this.received = this.corrupted = this.errors = this.reconnections = 0;
    this.rpcSuccess = this.rpcTimeout = this.rpcError = 0;
    this.downtimeTotal = 0;
    this.downtimeStart = null;
    this.crcSampleCounter = 0;
    this.tracker.reset();
    this.latencyAccum.reset();
    this.rpcLatencyAccum.reset();
    this.peakRate.reset();
    this.slidingRate.reset();
    this.tsStore.purge(0);
    this.consumerCounts.clear();
  }
}
