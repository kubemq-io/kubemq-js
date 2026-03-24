/**
 * PatternGroup: holds N BaseWorkers (one per channel) for a single pattern.
 * Provides aggregation methods and lifecycle management for multi-channel v2.
 */
import type { Config, PatternConfig } from './config.js';
import type { BaseWorker } from './workers/base.js';
import { LatencyAccumulator } from './peakRate.js';
import {
  EventsWorker,
  EventsStoreWorker,
  QueueStreamWorker,
  QueueSimpleWorker,
  CommandsWorker,
  QueriesWorker,
} from './workers/index.js';

const RPC_PATTERNS = ['commands', 'queries'];

export class PatternGroup {
  readonly pattern: string;
  readonly patternConfig: PatternConfig;
  readonly channelWorkers: BaseWorker[];
  readonly patternLatencyAccum: LatencyAccumulator;

  constructor(pattern: string, config: PatternConfig, burninConfig: Config, runId: string) {
    this.pattern = pattern;
    this.patternConfig = config;
    this.patternLatencyAccum = new LatencyAccumulator();
    this.channelWorkers = [];

    for (let i = 0; i < config.channels; i++) {
      const channelIndex = i + 1; // 1-based
      const chIdx = String(channelIndex).padStart(4, '0');
      const channelName = `js_burnin_${runId}_${pattern}_${chIdx}`;

      let worker: BaseWorker;
      switch (pattern) {
        case 'events':
          worker = new EventsWorker(burninConfig, runId, channelName, channelIndex, config);
          break;
        case 'events_store':
          worker = new EventsStoreWorker(burninConfig, runId, channelName, channelIndex, config);
          break;
        case 'queue_stream':
          worker = new QueueStreamWorker(burninConfig, runId, channelName, channelIndex, config);
          break;
        case 'queue_simple':
          worker = new QueueSimpleWorker(burninConfig, runId, channelName, channelIndex, config);
          break;
        case 'commands':
          worker = new CommandsWorker(burninConfig, runId, channelName, channelIndex, config);
          break;
        case 'queries':
          worker = new QueriesWorker(burninConfig, runId, channelName, channelIndex, config);
          break;
        default:
          throw new Error(`Unknown pattern: ${pattern}`);
      }

      // Wire the pattern-level latency accumulator for dual-write
      worker.patternLatencyAccum = this.patternLatencyAccum;
      this.channelWorkers.push(worker);
    }
  }

  // --- Lifecycle ---

  startConsumers(clients: Map<string, any>): void {
    for (const w of this.channelWorkers) {
      const client = clients.get(w.channelName);
      if (!client) throw new Error(`No client for channel ${w.channelName}`);
      w.startConsumers(client);
    }
  }

  startProducers(clients: Map<string, any>): void {
    for (const w of this.channelWorkers) {
      const client = clients.get(w.channelName);
      if (!client) throw new Error(`No client for channel ${w.channelName}`);
      w.startProducers(client);
    }
  }

  stopProducers(): void {
    for (const w of this.channelWorkers) {
      w.stopProducers();
    }
  }

  stopConsumers(): void {
    for (const w of this.channelWorkers) {
      w.stopConsumers();
    }
  }

  resetAfterWarmup(): void {
    for (const w of this.channelWorkers) {
      w.resetAfterWarmup();
    }
    this.patternLatencyAccum.reset();
  }

  // --- Aggregation methods ---

  totalSent(): number {
    return this.channelWorkers.reduce((sum, w) => sum + w.sent, 0);
  }

  totalReceived(): number {
    return this.channelWorkers.reduce((sum, w) => sum + w.received, 0);
  }

  totalLost(): number {
    return this.channelWorkers.reduce((sum, w) => sum + w.tracker.totalLost(), 0);
  }

  totalDuplicated(): number {
    return this.channelWorkers.reduce((sum, w) => sum + w.tracker.totalDuplicates(), 0);
  }

  totalCorrupted(): number {
    return this.channelWorkers.reduce((sum, w) => sum + w.corrupted, 0);
  }

  totalErrors(): number {
    return this.channelWorkers.reduce((sum, w) => sum + w.errors, 0);
  }

  totalBytesSent(): number {
    // Bytes are tracked via metrics, not per-worker counters; return 0 for now
    return 0;
  }

  totalBytesReceived(): number {
    return 0;
  }

  totalReconnections(): number {
    // Reconnection is connection-level, not channel-level.
    // Since all channels share a gRPC client, take max (they should all be equal).
    if (this.channelWorkers.length === 0) return 0;
    return Math.max(...this.channelWorkers.map((w) => w.reconnections));
  }

  maxDowntimeSeconds(): number {
    // Shared connection = max across channels = any single channel's downtime
    if (this.channelWorkers.length === 0) return 0;
    return Math.max(...this.channelWorkers.map((w) => w.downtimeSeconds));
  }

  totalRpcSuccess(): number {
    return this.channelWorkers.reduce((sum, w) => sum + w.rpcSuccess, 0);
  }

  totalRpcTimeout(): number {
    return this.channelWorkers.reduce((sum, w) => sum + w.rpcTimeout, 0);
  }

  totalRpcError(): number {
    return this.channelWorkers.reduce((sum, w) => sum + w.rpcError, 0);
  }

  totalOutOfOrder(): number {
    return this.channelWorkers.reduce((sum, w) => sum + w.tracker.totalOutOfOrder(), 0);
  }

  peakRate(): number {
    return Math.max(...this.channelWorkers.map((w) => w.peakRate.peak()), 0);
  }

  /** target_rate = rate * channels (total target, NOT per-channel) */
  get targetRate(): number {
    return this.patternConfig.rate * this.patternConfig.channels;
  }

  get isRpc(): boolean {
    return RPC_PATTERNS.includes(this.pattern);
  }

  /** Get channel names for cleanup */
  get channelNames(): string[] {
    return this.channelWorkers.map((w) => w.channelName);
  }
}
