/**
 * Engine v2: orchestrator with PatternGroup-based multi-channel architecture,
 * state machine lifecycle, parallel warmup with concurrency control,
 * 2-phase shutdown, and REST API getters.
 */
import {
  KubeMQClient,
  createEventMessage,
  createEventStoreMessage,
  createQueueMessage,
  createCommand,
  createQuery,
  EventStoreStartPosition,
} from 'kubemq-js';
import type { Config, PatternConfig } from './config.js';
import {
  durationSec,
  reportIntervalSec,
  warmupDurationSec,
  forcedDisconnectIntervalSec,
  forcedDisconnectDurationSec,
  reconnectIntervalMs,
  reconnectMaxIntervalMs,
  maxDurationSec,
} from './config.js';
import * as mc from './metrics.js';
import * as payload from './payload.js';
import {
  generateVerdict,
  generateStartupErrorVerdict,
  printConsoleReport,
  writeJsonReport,
} from './report.js';
import { DisconnectManager } from './disconnect.js';
import { PatternGroup } from './patternGroup.js';
import { ALL_PATTERNS } from './workers/index.js';
import type { BaseWorker } from './workers/base.js';

export type RunState = 'idle' | 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
export type PatternState = 'starting' | 'running' | 'recovering' | 'error' | 'stopped';

const CHANNEL_PREFIX = 'js_burnin_';
const WARMUP_COUNT = 3;
const MEMORY_BASELINE_5MIN = 300;
const MEMORY_BASELINE_1MIN = 60;

export class Engine {
  private startupCfg: Config;

  private _state: RunState = 'idle';
  private _error = '';
  private _runId: string | null = null;
  private _startedAt = '';
  private _endedAt = '';
  private _runCfg: Config | null = null;
  private _report: Record<string, any> | null = null;

  private client: KubeMQClient | null = null;
  /** Per-channel gRPC clients — each channel gets its own HTTP/2 connection for isolation. */
  private channelClients: Map<string, KubeMQClient> = new Map();
  private patternGroups: Map<string, PatternGroup> = new Map();
  private patternStates: Record<string, string> = {};
  private intervals: ReturnType<typeof setInterval>[] = [];
  private runAbort: AbortController | null = null;
  private runPromise: Promise<void> | null = null;

  private baselineRss = 0;
  private baselineSetAt: 'none' | '1min' | '5min' | 'running-start' = 'none';
  private peakRss = 0;
  private peakWorkers = 0;
  private testStarted = 0;
  private producersStopped = 0;
  private started = 0;
  private warmupActive = false;

  /** Snapshot of all pattern counters at producer-stop time (T2). */
  private producerStopSnapshot: Map<string, Record<string, any>> | null = null;

  readonly bootTime = Date.now();

  constructor(startupCfg: Config) {
    this.startupCfg = startupCfg;
  }

  get state(): RunState {
    return this._state;
  }
  get runId(): string | null {
    return this._runId;
  }
  get error(): string {
    return this._error;
  }
  get startedAt(): string {
    return this._startedAt;
  }
  get endedAt(): string {
    return this._endedAt;
  }
  get runConfig(): Config | null {
    return this._runCfg;
  }

  startRun(cfg: Config): void {
    // Deep-copy the run config to ensure it is fully isolated from any
    // external mutations (e.g. HTTP server re-using the startup config).
    const runCfg = JSON.parse(JSON.stringify(cfg)) as Config;
    this._state = 'starting';
    this._runId = runCfg.run_id;
    this._error = '';
    this._startedAt = new Date().toISOString();
    this._endedAt = '';
    this._runCfg = runCfg;
    this._report = null;
    this.started = performance.now();
    this.testStarted = 0;
    this.producersStopped = 0;
    this.producerStopSnapshot = null;
    this.baselineRss = 0;
    this.baselineSetAt = 'none';
    this.peakRss = this.getRssMb();
    this.peakWorkers = 0;
    this.patternGroups = new Map();
    this.channelClients = new Map();
    this.patternStates = {};
    this.intervals = [];
    this.warmupActive = false;

    mc.resetMetrics();

    this.runAbort = new AbortController();
    this.runPromise = this.executeRun(runCfg, this.runAbort.signal);
  }

  requestStop(): void {
    this._state = 'stopping';
    this.runAbort?.abort();
  }

  async waitForCompletion(): Promise<boolean> {
    if (this.runPromise) await this.runPromise;
    return this._report?.verdict?.result !== 'FAILED';
  }

  getInfo(): Record<string, any> {
    let sdkVersion = this.startupCfg.output.sdk_version;
    if (!sdkVersion) {
      try {
        const pkg = require('kubemq-js/package.json');
        sdkVersion = pkg.version;
      } catch {
        sdkVersion = 'unknown';
      }
    }
    return {
      sdk: 'js',
      sdk_version: sdkVersion,
      burnin_version: '2.0.0',
      burnin_spec_version: '2',
      os: process.platform,
      arch: process.arch,
      runtime: `node${process.versions.node}`,
      cpus: require('os').cpus().length,
      memory_total_mb: Math.round(require('os').totalmem() / (1024 * 1024)),
      pid: process.pid,
      uptime_seconds: Number(((Date.now() - this.bootTime) / 1000).toFixed(1)),
      started_at: new Date(this.bootTime).toISOString(),
      state: this._state,
      broker_address: this.startupCfg.broker.address,
    };
  }

  async pingBroker(): Promise<Record<string, any>> {
    const address = this.startupCfg.broker.address;
    let client: KubeMQClient | null = null;
    try {
      const t0 = performance.now();
      client = await KubeMQClient.create({ address, clientId: `burnin-js-ping-${Date.now()}` });
      const info = await Promise.race([
        client.ping(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('ping timeout (3s)')), 3000),
        ),
      ]);
      const latency = performance.now() - t0;
      try {
        await client.close();
      } catch {}
      return {
        connected: true,
        address,
        ping_latency_ms: Number(latency.toFixed(1)),
        server_version: (info as any).version ?? 'unknown',
        last_ping_at: new Date().toISOString(),
      };
    } catch (err) {
      try {
        await client?.close();
      } catch {}
      return {
        connected: false,
        address,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async cleanupChannels(): Promise<Record<string, any>> {
    const address = this.startupCfg.broker.address;
    let client: KubeMQClient | null = null;
    const deleted: string[] = [];
    const failed: string[] = [];
    // Use run-scoped prefix if we have a run_id, otherwise clean all
    const prefix = this._runId ? `${CHANNEL_PREFIX}${this._runId}_` : CHANNEL_PREFIX;
    try {
      client = await KubeMQClient.create({ address, clientId: `burnin-js-cleanup-${Date.now()}` });
      const ops: [() => Promise<any[]>, (n: string) => Promise<void>][] = [
        [() => client!.listEventsChannels(prefix), (n) => client!.deleteEventsChannel(n)],
        [() => client!.listEventsStoreChannels(prefix), (n) => client!.deleteEventsStoreChannel(n)],
        [() => client!.listQueuesChannels(prefix), (n) => client!.deleteQueuesChannel(n)],
        [() => client!.listCommandsChannels(prefix), (n) => client!.deleteCommandsChannel(n)],
        [() => client!.listQueriesChannels(prefix), (n) => client!.deleteQueriesChannel(n)],
      ];
      for (const [listFn, delFn] of ops) {
        try {
          const channels = await listFn();
          for (const ch of channels ?? []) {
            try {
              await delFn(ch.name);
              deleted.push(ch.name);
            } catch {
              failed.push(ch.name);
            }
          }
        } catch {}
      }
      try {
        await client.close();
      } catch {}

      const patternCount =
        this.patternGroups.size ||
        Object.keys(this._runCfg?.patterns ?? {}).filter((k) => this._runCfg?.patterns[k]?.enabled)
          .length;
      return {
        deleted_channels: deleted,
        failed_channels: failed,
        message: `cleaned ${deleted.length} channels across ${patternCount} patterns`,
      };
    } catch (err) {
      try {
        await client?.close();
      } catch {}
      return {
        deleted_channels: deleted,
        failed_channels: failed,
        message: `Could not connect to broker: ${err instanceof Error ? err.message : err}`,
      };
    }
  }

  buildRunResponse(): Record<string, any> {
    if (this._state === 'idle') return { run_id: null, state: 'idle' };
    if (this._state === 'error') {
      return {
        run_id: this._runId,
        state: 'error',
        error: this._error,
        started_at: this._startedAt,
        elapsed_seconds: this.getElapsed(),
        patterns: this.buildPatternsResponse(),
        resources: this.buildResourcesLive(),
      };
    }
    const cfg = this._runCfg!;
    const elapsed = this.getElapsed();
    const dur = durationSec(cfg.duration);
    const remaining = dur > 0 ? Math.max(0, dur - elapsed) : 0;
    return {
      run_id: this._runId,
      state: this._state,
      mode: cfg.mode,
      started_at: this._startedAt,
      ...(this._endedAt ? { ended_at: this._endedAt } : {}),
      elapsed_seconds: Math.round(elapsed),
      remaining_seconds: Math.round(remaining),
      duration: cfg.duration,
      warmup_active: this.warmupActive,
      broker_address: this.startupCfg.broker.address,
      patterns: this.buildPatternsResponse(),
      resources: this.buildResourcesLive(),
    };
  }

  buildRunStatus(): Record<string, any> {
    if (this._state === 'idle') return { run_id: null, state: 'idle' };
    if (this._state === 'error' && !this._runCfg) {
      return { run_id: this._runId, state: 'error', error: this._error };
    }
    const elapsed = this.getElapsed();
    const dur = this._runCfg ? durationSec(this._runCfg.duration) : 0;
    const remaining = dur > 0 ? Math.max(0, dur - elapsed) : 0;

    const totals = {
      sent: 0,
      received: 0,
      lost: 0,
      duplicated: 0,
      corrupted: 0,
      out_of_order: 0,
      errors: 0,
      reconnections: 0,
    };
    for (const pg of this.patternGroups.values()) {
      totals.sent += pg.totalSent();
      totals.received += pg.isRpc ? pg.totalRpcSuccess() : pg.totalReceived();
      totals.lost += pg.totalLost() + (pg.isRpc ? pg.totalRpcTimeout() + pg.totalRpcError() : 0);
      totals.duplicated += pg.totalDuplicated();
      totals.corrupted += pg.totalCorrupted();
      totals.out_of_order += pg.totalOutOfOrder();
      totals.errors += pg.totalErrors();
      totals.reconnections += pg.totalReconnections();
    }

    const patternStateMap: Record<string, any> = {};
    if (this._runCfg) {
      for (const [name, pc] of Object.entries(this._runCfg.patterns)) {
        if (!pc.enabled) continue;
        patternStateMap[name] = {
          state: this.patternStates[name] ?? 'stopped',
          channels: pc.channels,
        };
      }
    }

    return {
      run_id: this._runId,
      state: this._state,
      started_at: this._startedAt,
      elapsed_seconds: Math.round(elapsed),
      remaining_seconds: Math.round(remaining),
      warmup_active: this.warmupActive,
      totals,
      pattern_states: patternStateMap,
    };
  }

  buildRunConfigResponse(): Record<string, any> | null {
    if (!this._runCfg) return null;
    const cfg = this._runCfg;
    const rid = cfg.run_id;
    const patterns: Record<string, any> = {};

    for (const [name, pc] of Object.entries(cfg.patterns)) {
      if (!pc.enabled) {
        patterns[name] = { enabled: false };
        continue;
      }
      const isRpc = ['commands', 'queries'].includes(name);
      const base: Record<string, any> = {
        enabled: true,
        channels: pc.channels,
        rate: pc.rate,
        thresholds: {
          max_p99_latency_ms:
            pc.thresholds?.max_p99_latency_ms ?? cfg.thresholds.max_p99_latency_ms,
          max_p999_latency_ms:
            pc.thresholds?.max_p999_latency_ms ?? cfg.thresholds.max_p999_latency_ms,
        },
      };
      if (isRpc) {
        base.senders_per_channel = pc.senders_per_channel;
        base.responders_per_channel = pc.responders_per_channel;
      } else {
        base.producers_per_channel = pc.producers_per_channel;
        base.consumers_per_channel = pc.consumers_per_channel;
        if (['events', 'events_store'].includes(name)) {
          base.consumer_group = pc.consumer_group;
        }
        const lossKey =
          name === 'events' ? cfg.thresholds.max_events_loss_pct : cfg.thresholds.max_loss_pct;
        base.thresholds.max_loss_pct = pc.thresholds?.max_loss_pct ?? lossKey;
      }
      patterns[name] = base;
    }

    return {
      run_id: this._runId,
      state: this._state,
      config: {
        version: '2',
        mode: cfg.mode,
        duration: cfg.duration,
        run_id: cfg.run_id,
        starting_timeout_seconds: cfg.starting_timeout_seconds,
        broker: {
          address: this.startupCfg.broker.address,
          client_id_prefix: cfg.broker.client_id_prefix,
        },
        patterns,
        queue: {
          poll_max_messages: cfg.queue.poll_max_messages,
          poll_wait_timeout_seconds: cfg.queue.poll_wait_timeout_seconds,
          auto_ack: cfg.queue.auto_ack,
          max_depth: cfg.queue.max_depth,
        },
        rpc: cfg.rpc,
        message: cfg.message,
        thresholds: cfg.thresholds,
        forced_disconnect: cfg.forced_disconnect,
        warmup: cfg.warmup,
        shutdown: cfg.shutdown,
        metrics: { report_interval: cfg.metrics.report_interval },
      },
    };
  }

  buildRunReport(): Record<string, any> | null {
    return this._report;
  }

  // --- Private: Run execution ---

  private async executeRun(cfg: Config, signal: AbortSignal): Promise<void> {
    let startTimeoutHandle: ReturnType<typeof setTimeout> | null = null;

    try {
      startTimeoutHandle = setTimeout(() => {
        if (this._state === 'starting') {
          this._error = `Starting timeout exceeded (${cfg.starting_timeout_seconds}s)`;
          this._state = 'error';
          this._endedAt = new Date().toISOString();
          this._report = this.buildErrorReport(cfg, this._error);
          this.runAbort?.abort();
        }
      }, cfg.starting_timeout_seconds * 1000);

      this.client = await this.createClient(cfg);
      if (signal.aborted) {
        this.finishIfStopping(cfg);
        return;
      }

      console.log(`client created, pinging broker at ${this.startupCfg.broker.address}`);
      const info = await this.client.ping();
      console.log(`broker ping ok: ${info.host} v${info.version}`);
      if (signal.aborted) {
        this.finishIfStopping(cfg);
        return;
      }

      console.log(
        'skipping stale channel cleanup at startup (channels auto-create on subscribe/send)',
      );
      if (signal.aborted) {
        this.finishIfStopping(cfg);
        return;
      }

      // Create pattern groups
      this.createPatternGroups(cfg);

      if (signal.aborted) {
        this.finishIfStopping(cfg);
        return;
      }

      if (cfg.mode === 'benchmark') {
        for (const pc of Object.values(cfg.patterns)) {
          pc.rate = 0;
        }
      }

      // Create per-channel gRPC clients (each channel gets its own HTTP/2 connection for isolation)
      this.channelClients = new Map();
      let totalChannels = 0;
      const createOps: Promise<void>[] = [];
      for (const [name, pg] of this.patternGroups) {
        for (const w of pg.channelWorkers) {
          totalChannels++;
          createOps.push(
            this.createClient(cfg, `${name}-ch${w.channelIndex}`).then((c) => {
              this.channelClients.set(w.channelName, c);
            }),
          );
        }
      }
      console.log(`creating ${totalChannels} per-channel gRPC clients`);
      await Promise.all(createOps);
      console.log(`all per-channel clients created`);

      if (signal.aborted) {
        this.finishIfStopping(cfg);
        return;
      }

      // Set target rates per pattern
      for (const [name, pg] of this.patternGroups) {
        mc.setTargetRate(name, pg.targetRate);
      }

      // Step 1: Start ALL consumers/responders across ALL channels and ALL patterns
      for (const [name, pg] of this.patternGroups) {
        this.patternStates[name] = 'starting';
        pg.startConsumers(this.channelClients);
        console.log(`consumers started: ${name} (${pg.channelWorkers.length} channels)`);
      }

      // Step 2: Warmup all channels
      await this.runWarmup(cfg);
      if (signal.aborted) {
        this.finishIfStopping(cfg);
        return;
      }

      // Reset all counters after warmup verification (spec: resetAfterWarmup on ALL ChannelWorkers)
      for (const pg of this.patternGroups.values()) pg.resetAfterWarmup();
      console.log('warmup verification complete, counters reset');

      // Step 3: Start ALL producers/senders (each channel uses its own gRPC client)
      for (const [name, pg] of this.patternGroups) {
        pg.startProducers(this.channelClients);
        console.log(`producers started: ${name} (${pg.channelWorkers.length} channels)`);
      }

      this.printBanner(cfg);

      // Warmup duration (benchmark mode)
      const warmupSec = warmupDurationSec(cfg);
      if (warmupSec > 0) {
        mc.setWarmupActive(1);
        this.warmupActive = true;
        console.log(`warmup period: ${warmupSec}s`);
        await this.delay(warmupSec * 1000, signal);
        if (signal.aborted) {
          mc.setWarmupActive(0);
          this.warmupActive = false;
          this.finishIfStopping(cfg);
          return;
        }
        for (const pg of this.patternGroups.values()) pg.resetAfterWarmup();
        mc.setWarmupActive(0);
        this.warmupActive = false;
        console.log('warmup complete, counters reset');
      }

      if (startTimeoutHandle) {
        clearTimeout(startTimeoutHandle);
        startTimeoutHandle = null;
      }

      this.testStarted = performance.now();
      for (const name of this.patternGroups.keys()) this.patternStates[name] = 'running';
      if (this._state === 'starting') this._state = 'running';

      this.startPeriodicTasks(cfg);

      const dm = new DisconnectManager(
        forcedDisconnectIntervalSec(cfg),
        forcedDisconnectDurationSec(cfg),
        this,
      );
      if (dm.enabled) {
        dm.start();
        console.log('disconnect manager enabled');
      }

      const dur = durationSec(cfg.duration);
      const effectiveDur = dur > 0 ? dur : maxDurationSec(cfg);
      console.log(`running for ${effectiveDur}s (or until stopped)`);
      await this.delay(effectiveDur * 1000, signal);

      if (dm.enabled) dm.stop();

      if (this._state === 'running') this._state = 'stopping';
      await this.performShutdown(cfg);
      if (this._state === 'stopping') this._state = 'stopped';
    } catch (err) {
      if (startTimeoutHandle) clearTimeout(startTimeoutHandle);
      if (this._state !== 'error') {
        this._error = err instanceof Error ? err.message : String(err);
        this._state = 'error';
        this._endedAt = new Date().toISOString();
        this._report = this.buildErrorReport(cfg, this._error);
      }
      try {
        await this.safeCleanup(cfg);
      } catch {}
    }
  }

  private async finishIfStopping(cfg: Config): Promise<void> {
    if (this._state === 'error') return;
    try {
      await this.performShutdown(cfg);
    } catch {}
    if (this._state === 'stopping') this._state = 'stopped';
  }

  private async performShutdown(cfg: Config): Promise<void> {
    this._endedAt = new Date().toISOString();
    for (const i of this.intervals) clearInterval(i);
    this.intervals = [];
    console.log('initiating 2-phase shutdown');

    const drain = cfg.shutdown.drain_timeout_seconds;
    const hardDeadline = Date.now() + (drain + 5) * 1000;

    // Phase 1: stop ALL producers across ALL channels across ALL patterns
    for (const [name, pg] of this.patternGroups) {
      this.patternStates[name] = 'stopped';
    }

    // Snapshot all counters BEFORE stopping producers so the final report
    // reflects a clean measurement window and excludes drain-phase events.
    this.producerStopSnapshot = this.capturePatternSnapshots();
    console.log('producer-stop snapshot captured');

    this.producersStopped = performance.now();
    for (const [, pg] of this.patternGroups) {
      pg.stopProducers();
    }

    console.log(`producers stopped, draining for ${drain}s`);
    await this.delay(drain * 1000);

    // Phase 2: stop ALL consumers across ALL channels across ALL patterns
    for (const pg of this.patternGroups.values()) {
      pg.stopConsumers();
    }
    console.log('consumers stopped');

    if (this.baselineRss === 0) {
      this.baselineRss = this.getRssMb();
      this.baselineSetAt = 'running-start';
    }

    const remaining = Math.max(1000, hardDeadline - Date.now());
    if (cfg.shutdown.cleanup_channels) {
      await Promise.race([this.cleanStaleChannels(), this.delay(remaining)]);
    }

    const memoryBaselineAdvisory = this.baselineSetAt !== '5min';
    const summary = this.buildSummary(cfg, 'completed');
    const verdict = generateVerdict(summary, cfg, memoryBaselineAdvisory);
    summary.verdict = verdict;
    this._report = summary;

    if (cfg.output.report_file) writeJsonReport(summary, cfg.output.report_file);
    printConsoleReport(summary);

    const closeRemaining = Math.max(500, hardDeadline - Date.now());
    await Promise.race([
      (async () => {
        // Close per-pattern clients in parallel
        const closeOps: Promise<void>[] = [];
        for (const [, pc] of this.channelClients) {
          closeOps.push(pc.close().catch(() => {}));
        }
        closeOps.push(this.client?.close().catch(() => {}) ?? Promise.resolve());
        await Promise.all(closeOps);
      })(),
      this.delay(closeRemaining),
    ]);
    this.channelClients.clear();
    this.client = null;
  }

  private async safeCleanup(cfg: Config): Promise<void> {
    for (const i of this.intervals) clearInterval(i);
    this.intervals = [];
    for (const pg of this.patternGroups.values()) {
      try {
        pg.stopProducers();
      } catch {}
    }
    for (const pg of this.patternGroups.values()) {
      try {
        pg.stopConsumers();
      } catch {}
    }
    for (const [, pc] of this.channelClients) {
      try {
        await pc.close();
      } catch {}
    }
    this.channelClients.clear();
    try {
      await this.client?.close();
    } catch {}
    this.client = null;
  }

  private buildErrorReport(cfg: Config, errorMsg: string): Record<string, any> {
    let sdkVersion = cfg.output.sdk_version;
    if (!sdkVersion) {
      try {
        const pkg = require('kubemq-js/package.json');
        sdkVersion = pkg.version;
      } catch {
        sdkVersion = 'unknown';
      }
    }
    return {
      run_id: this._runId,
      sdk: 'js',
      sdk_version: sdkVersion,
      mode: cfg.mode,
      broker_address: this.startupCfg.broker.address,
      started_at: this._startedAt,
      ended_at: this._endedAt,
      duration_seconds: this.getElapsed(),
      all_patterns_enabled: ALL_PATTERNS.every((p) => cfg.patterns[p]?.enabled !== false),
      patterns: {},
      resources: {
        peak_rss_mb: this.peakRss || this.getRssMb(),
        baseline_rss_mb: this.baselineRss || this.getRssMb(),
        memory_growth_factor: 1,
        peak_workers: this.peakWorkers,
      },
      verdict: generateStartupErrorVerdict(errorMsg),
    };
  }

  // --- ClientRecreator interface ---
  async closeClient(): Promise<void> {
    for (const [name, pg] of this.patternGroups) {
      this.patternStates[name] = 'recovering';
      mc.setActiveConnections(name, 0);
    }
    const closeOps: Promise<void>[] = [];
    for (const [, pc] of this.channelClients) {
      closeOps.push(pc.close().catch(() => {}));
    }
    closeOps.push(this.client?.close().catch(() => {}) ?? Promise.resolve());
    await Promise.all(closeOps);
  }

  async recreateClient(): Promise<void> {
    if (!this._runCfg) return;
    this.client = await this.createClient(this._runCfg);
    // Recreate per-channel clients
    this.channelClients = new Map();
    const createOps: Promise<void>[] = [];
    for (const [name, pg] of this.patternGroups) {
      for (const w of pg.channelWorkers) {
        createOps.push(
          this.createClient(this._runCfg!, `${name}-ch${w.channelIndex}`).then((c) => {
            this.channelClients.set(w.channelName, c);
          }),
        );
      }
    }
    await Promise.all(createOps);
    for (const name of this.patternGroups.keys()) this.patternStates[name] = 'running';
  }

  // --- Private helpers ---

  private async createClient(cfg: Config, suffix?: string): Promise<KubeMQClient> {
    const initMs = Math.max(50, Math.min(reconnectIntervalMs(cfg), 5000));
    const maxMs = Math.max(1000, Math.min(reconnectMaxIntervalMs(cfg), 120000));
    const mult = Math.max(1.5, Math.min(cfg.recovery.reconnect_multiplier, 3.0));
    const clientId = suffix
      ? `${cfg.broker.client_id_prefix}-${cfg.run_id}-${suffix}`
      : `${cfg.broker.client_id_prefix}-${cfg.run_id}`;
    return KubeMQClient.create({
      address: this.startupCfg.broker.address,
      clientId,
      reconnect: {
        maxAttempts: -1,
        initialDelayMs: initMs,
        maxDelayMs: maxMs,
        multiplier: mult,
        jitter: 'full',
      },
      retry: {
        maxRetries: 5,
        initialBackoffMs: initMs,
        maxBackoffMs: maxMs,
        multiplier: mult,
        jitter: 'full',
      },
    });
  }

  private createPatternGroups(cfg: Config): void {
    const rid = cfg.run_id;
    this.patternGroups = new Map();

    for (const [name, pc] of Object.entries(cfg.patterns)) {
      if (!pc.enabled) continue;
      const pg = new PatternGroup(name, pc, cfg, rid);
      this.patternGroups.set(name, pg);
    }
  }

  private async runWarmup(cfg: Config): Promise<void> {
    if (!this.client) return;
    console.log('running warmup verification');

    const maxParallel = cfg.warmup.max_parallel_channels;
    const timeoutMs = cfg.warmup.timeout_per_channel_ms;
    const maxRetries = 3;

    // Collect all channels that need warmup
    const warmupTasks: { pattern: string; channelName: string; channelIndex: number }[] = [];
    for (const [name, pg] of this.patternGroups) {
      for (const w of pg.channelWorkers) {
        warmupTasks.push({
          pattern: name,
          channelName: w.channelName,
          channelIndex: w.channelIndex,
        });
      }
    }

    // Parallel warmup with concurrency pool
    let idx = 0;
    const errors: string[] = [];

    const runBatch = async (): Promise<void> => {
      while (idx < warmupTasks.length && errors.length === 0) {
        const task = warmupTasks[idx++];
        if (!task) break;

        let success = false;
        for (let attempt = 0; attempt < maxRetries && !success; attempt++) {
          try {
            await this.warmupChannel(cfg, task.pattern, task.channelName, timeoutMs);
            success = true;
          } catch (e) {
            if (attempt === maxRetries - 1) {
              errors.push(
                `warmup failed for ${task.channelName} after ${maxRetries} retries: ${e instanceof Error ? e.message : e}`,
              );
            }
          }
        }
      }
    };

    const pool: Promise<void>[] = [];
    for (let i = 0; i < Math.min(maxParallel, warmupTasks.length); i++) {
      pool.push(runBatch());
    }
    await Promise.all(pool);

    if (errors.length > 0) {
      throw new Error(`Warmup failed: ${errors.join('; ')}`);
    }

    console.log(`warmup verification complete (${warmupTasks.length} channels)`);
  }

  private async warmupChannel(
    cfg: Config,
    pattern: string,
    channelName: string,
    timeoutMs: number,
  ): Promise<void> {
    const warmupPromise = this.doWarmupChannel(cfg, pattern, channelName);
    const result = await Promise.race([
      warmupPromise.then(() => 'ok' as const),
      this.delay(timeoutMs).then(() => 'timeout' as const),
    ]);
    if (result === 'timeout') {
      throw new Error(`warmup timeout (${timeoutMs}ms)`);
    }
  }

  private async doWarmupChannel(cfg: Config, pattern: string, channelName: string): Promise<void> {
    // Use per-pattern client for warmup (falls back to shared client)
    const client = this.channelClients.get(pattern) ?? this.client;
    if (!client) return;

    switch (pattern) {
      case 'events':
        await this.warmupEvents(client, channelName);
        break;
      case 'events_store':
        await this.warmupEventsStore(client, channelName);
        break;
      case 'queue_stream':
      case 'queue_simple':
        // Skip warmup sends for queue patterns — queue channels
        // auto-create on first send/poll, and warmup messages leave
        // unacked items that cause false duplicates.
        break;
      case 'commands':
        await this.warmupRpc(client, channelName, 'commands');
        break;
      case 'queries':
        await this.warmupRpc(client, channelName, 'queries');
        break;
    }
  }

  private async warmupEvents(client: KubeMQClient, ch: string): Promise<void> {
    let count = 0;
    let resolve: (() => void) | null = null;
    const firstReceived = new Promise<void>((r) => {
      resolve = r;
    });
    const sub = client.subscribeToEvents({
      channel: ch,
      onEvent: (e) => {
        if (e.tags?.warmup === 'true') {
          count++;
          if (count === 1 && resolve) resolve();
        }
      },
      onError: () => {},
    });
    await this.delay(200);
    const stream = client.createEventStream();
    for (let i = 0; i < WARMUP_COUNT; i++) {
      try {
        stream.send(
          createEventMessage({
            channel: ch,
            body: Buffer.from(`warmup-${i}`),
            tags: { warmup: 'true', content_hash: '00000000' },
          }),
        );
      } catch {}
      await new Promise((r) => setTimeout(r, 50));
    }
    // Wait for first message (event-driven) instead of fixed 1500ms
    await Promise.race([firstReceived, this.delay(2000)]);
    stream.close();
    sub.cancel();
    if (count < 1) throw new Error(`events warmup: 0/${WARMUP_COUNT} received on ${ch}`);
    console.log(`warmup events ${ch}: sent=${WARMUP_COUNT} received=${count}`);
  }

  private async warmupEventsStore(client: KubeMQClient, ch: string): Promise<void> {
    let count = 0;
    let resolve: (() => void) | null = null;
    const firstReceived = new Promise<void>((r) => {
      resolve = r;
    });
    const sub = client.subscribeToEventsStore({
      channel: ch,
      startFrom: EventStoreStartPosition.StartFromNew,
      onEvent: (e) => {
        if (e.tags?.warmup === 'true') {
          count++;
          if (count === 1 && resolve) resolve();
        }
      },
      onError: () => {},
    });
    await this.delay(200);
    for (let i = 0; i < WARMUP_COUNT; i++) {
      try {
        await client.sendEventStore(
          createEventStoreMessage({
            channel: ch,
            body: Buffer.from(`warmup-${i}`),
            tags: { warmup: 'true', content_hash: '00000000' },
          }),
        );
      } catch {}
      await new Promise((r) => setTimeout(r, 50));
    }
    // Wait for first message (event-driven) instead of fixed 1500ms
    await Promise.race([firstReceived, this.delay(2000)]);
    sub.cancel();
    if (count < 1) throw new Error(`events_store warmup: 0/${WARMUP_COUNT} received on ${ch}`);
    console.log(`warmup events_store ${ch}: sent=${WARMUP_COUNT} received=${count}`);
  }

  private async warmupQueue(ch: string, pattern: string): Promise<void> {
    let sent = 0;
    if (pattern === 'queue_stream') {
      const upstream = this.client!.createQueueUpstream();
      for (let i = 0; i < WARMUP_COUNT; i++) {
        try {
          await upstream.send([
            createQueueMessage({
              channel: ch,
              body: Buffer.from(`warmup-${i}`),
              tags: { warmup: 'true', content_hash: '00000000' },
            }),
          ]);
          sent++;
        } catch {}
        await new Promise((r) => setTimeout(r, 100));
      }
      upstream.close();
    } else {
      for (let i = 0; i < WARMUP_COUNT; i++) {
        try {
          await this.client!.sendQueueMessage(
            createQueueMessage({
              channel: ch,
              body: Buffer.from(`warmup-${i}`),
              tags: { warmup: 'true', content_hash: '00000000' },
            }),
          );
          sent++;
        } catch {}
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    if (sent < 1) throw new Error(`${pattern} warmup: sent 0/${WARMUP_COUNT} on ${ch}`);
    console.log(`warmup ${pattern} ${ch}: sent=${sent}/${WARMUP_COUNT}`);
  }

  private async warmupRpc(client: KubeMQClient, ch: string, pattern: string): Promise<void> {
    let responded = 0;
    const sub =
      pattern === 'commands'
        ? client.subscribeToCommands({
            channel: ch,
            onCommand: (cmd) => {
              try {
                client.sendCommandResponse({
                  id: cmd.id,
                  replyChannel: cmd.replyChannel,
                  executed: true,
                });
                responded++;
              } catch {}
            },
            onError: () => {},
          })
        : client.subscribeToQueries({
            channel: ch,
            onQuery: (q) => {
              try {
                client.sendQueryResponse({
                  id: q.id,
                  replyChannel: q.replyChannel,
                  executed: true,
                  body: q.body,
                });
                responded++;
              } catch {}
            },
            onError: () => {},
          });
    await this.delay(200);
    const timeoutInSeconds = Math.max(this._runCfg?.rpc.timeout_ms ?? 5000, 5000) / 1000;
    let success = 0;
    for (let i = 0; i < WARMUP_COUNT; i++) {
      try {
        if (pattern === 'commands')
          await client.sendCommand(
            createCommand({
              channel: ch,
              body: Buffer.from(`warmup-${i}`),
              timeoutInSeconds,
              tags: { warmup: 'true', content_hash: '00000000' },
            }),
          );
        else
          await client.sendQuery(
            createQuery({
              channel: ch,
              body: Buffer.from(`warmup-${i}`),
              timeoutInSeconds,
              tags: { warmup: 'true', content_hash: '00000000' },
            }),
          );
        success++;
      } catch {}
    }
    sub.cancel();
    if (success < 1) throw new Error(`${pattern} warmup: 0/${WARMUP_COUNT} succeeded on ${ch}`);
    console.log(`warmup ${pattern} ${ch}: sent=${success} responded=${responded}`);
  }

  private async cleanStaleChannels(): Promise<void> {
    if (!this.client) return;
    console.log(`cleaning stale channels with prefix '${CHANNEL_PREFIX}'`);
    let count = 0;
    const ops: [() => Promise<any[]>, (name: string) => Promise<void>][] = [
      [
        () => this.client!.listEventsChannels(CHANNEL_PREFIX),
        (n) => this.client!.deleteEventsChannel(n),
      ],
      [
        () => this.client!.listEventsStoreChannels(CHANNEL_PREFIX),
        (n) => this.client!.deleteEventsStoreChannel(n),
      ],
      [
        () => this.client!.listQueuesChannels(CHANNEL_PREFIX),
        (n) => this.client!.deleteQueuesChannel(n),
      ],
      [
        () => this.client!.listCommandsChannels(CHANNEL_PREFIX),
        (n) => this.client!.deleteCommandsChannel(n),
      ],
      [
        () => this.client!.listQueriesChannels(CHANNEL_PREFIX),
        (n) => this.client!.deleteQueriesChannel(n),
      ],
    ];
    for (const [listFn, delFn] of ops) {
      try {
        const channels = await listFn();
        for (const ch of channels ?? []) {
          try {
            await delFn(ch.name);
            count++;
          } catch {}
        }
      } catch {}
    }
    console.log(`cleaned ${count} stale channels from prior runs`);
  }

  private startPeriodicTasks(cfg: Config): void {
    this.intervals.push(setInterval(() => this.periodicReport(cfg), reportIntervalSec(cfg) * 1000));
    this.intervals.push(
      setInterval(() => {
        for (const pg of this.patternGroups.values()) {
          for (const w of pg.channelWorkers) {
            w.peakRate.advance();
            w.slidingRate.advance();
          }
        }
      }, 1000),
    );
    this.intervals.push(
      setInterval(() => {
        mc.setUptime((performance.now() - this.started) / 1000);
        const handles = (process as any)._getActiveHandles?.()?.length ?? 0;
        mc.setActiveWorkers(handles);
        this.peakWorkers = Math.max(this.peakWorkers, handles);
      }, 1000),
    );
    {
      const runningStartRss = this.getRssMb();
      const runDurSec = durationSec(cfg.duration);
      const effectiveRunDur = runDurSec > 0 ? runDurSec : maxDurationSec(cfg);
      if (effectiveRunDur < MEMORY_BASELINE_1MIN) {
        this.baselineRss = runningStartRss;
        this.baselineSetAt = 'running-start';
        console.log(`memory baseline set (running-start): ${runningStartRss.toFixed(1)} MB`);
      }
      this.intervals.push(
        setInterval(() => {
          const rss = this.getRssMb();
          if (rss > this.peakRss) this.peakRss = rss;
          if (this.baselineRss !== 0) return;
          const elapsed = (performance.now() - this.testStarted) / 1000;
          if (effectiveRunDur < MEMORY_BASELINE_5MIN && elapsed >= MEMORY_BASELINE_1MIN) {
            this.baselineRss = rss;
            this.baselineSetAt = '1min';
            console.log(
              `memory baseline set (1min): ${rss.toFixed(1)} MB at ${elapsed.toFixed(0)}s`,
            );
          } else if (elapsed >= MEMORY_BASELINE_5MIN) {
            this.baselineRss = rss;
            this.baselineSetAt = '5min';
            console.log(
              `memory baseline set (5min): ${rss.toFixed(1)} MB at ${elapsed.toFixed(0)}s`,
            );
          }
        }, 10000),
      );
    }
    this.intervals.push(
      setInterval(() => {
        for (const pg of this.patternGroups.values()) {
          for (const w of pg.channelWorkers) w.tsStore.purge(10000);
        }
      }, 10000),
    );
    this.peakRss = Math.max(this.peakRss, this.getRssMb());
  }

  private periodicReport(cfg: Config): void {
    const elapsed =
      this.testStarted > 0
        ? (performance.now() - this.testStarted) / 1000
        : (performance.now() - this.started) / 1000;
    const rss = this.getRssMb();

    for (const [name, pg] of this.patternGroups) {
      for (const w of pg.channelWorkers) {
        const gaps = w.tracker.detectGaps();
        for (const [, delta] of gaps) mc.incLost(w.pattern, delta);
      }
      mc.setConsumerLag(name, Math.max(0, pg.totalSent() - pg.totalReceived()));
      if (elapsed > 0) mc.setActualRate(name, pg.totalSent() / elapsed);

      // Group balance across all channels
      const allCounts: number[] = [];
      for (const w of pg.channelWorkers) {
        for (const count of w.consumerCounts.values()) allCounts.push(count);
      }
      if (allCounts.length > 1) {
        const min = Math.min(...allCounts),
          max = Math.max(...allCounts);
        mc.setGroupBalance(name, max > 0 ? min / max : 1.0);
      }
    }

    if (cfg.logging.format === 'json') {
      const patternsObj: Record<string, any> = {};
      for (const [name, pg] of this.patternGroups) {
        const sent = pg.totalSent();
        const rate = elapsed > 0 ? Math.round(sent / elapsed) : 0;
        patternsObj[name] = {
          sent,
          recv: pg.isRpc ? pg.totalRpcSuccess() : pg.totalReceived(),
          lost: pg.totalLost(),
          dup: pg.totalDuplicated(),
          err: pg.totalErrors(),
          channels: pg.patternConfig.channels,
          p99_ms: pg.patternLatencyAccum.percentileMs(99),
          rate,
        };
      }
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          level: 'info',
          msg: 'periodic_status',
          uptime_s: Math.floor(elapsed),
          mode: cfg.mode,
          rss_mb: Math.round(rss),
          patterns: patternsObj,
        }),
      );
    } else {
      const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
      const uptimeStr = formatDuration(elapsed);
      const lines = [
        `[${ts}] BURN-IN STATUS | uptime=${uptimeStr} mode=${cfg.mode} rss=${rss.toFixed(0)}MB`,
      ];
      for (const [name, pg] of this.patternGroups) {
        const sent = pg.totalSent();
        const rate = elapsed > 0 ? (sent / elapsed).toFixed(0) : '0';
        const chCount = pg.patternConfig.channels;
        const label = chCount > 1 ? `${name} (${chCount}ch)` : name;
        if (pg.isRpc) {
          lines.push(
            `  ${label.padEnd(20)} sent=${String(sent).padEnd(8)} resp=${String(pg.totalRpcSuccess()).padEnd(8)} tout=${String(pg.totalRpcTimeout()).padEnd(4)} err=${String(pg.totalErrors()).padEnd(4)} p99=${pg.patternLatencyAccum.percentileMs(99).toFixed(1)}ms rate=${rate}/s`,
          );
        } else {
          lines.push(
            `  ${label.padEnd(20)} sent=${String(sent).padEnd(8)} recv=${String(pg.totalReceived()).padEnd(8)} lost=${String(pg.totalLost()).padEnd(4)} dup=${String(pg.totalDuplicated()).padEnd(4)} err=${String(pg.totalErrors()).padEnd(4)} p99=${pg.patternLatencyAccum.percentileMs(99).toFixed(1)}ms rate=${rate}/s`,
          );
        }
      }
      console.log(lines.join('\n'));
    }
  }

  private capturePatternSnapshots(): Map<string, Record<string, any>> {
    const snapshots = new Map<string, Record<string, any>>();
    for (const [name, pg] of this.patternGroups) {
      const snap: Record<string, any> = {
        sent: pg.totalSent(),
        received: pg.totalReceived(),
        lost: pg.totalLost(),
        duplicated: pg.totalDuplicated(),
        corrupted: pg.totalCorrupted(),
        outOfOrder: pg.totalOutOfOrder(),
        errors: pg.totalErrors(),
        reconnections: pg.totalReconnections(),
        bytesSent: pg.totalBytesSent(),
        bytesReceived: pg.totalBytesReceived(),
        rpcSuccess: pg.totalRpcSuccess(),
        rpcTimeout: pg.totalRpcTimeout(),
        rpcError: pg.totalRpcError(),
        peakRate: pg.peakRate(),
        downtimeSeconds: pg.maxDowntimeSeconds(),
        latencyP50: pg.patternLatencyAccum.percentileMs(50),
        latencyP95: pg.patternLatencyAccum.percentileMs(95),
        latencyP99: pg.patternLatencyAccum.percentileMs(99),
        latencyP999: pg.patternLatencyAccum.percentileMs(99.9),
        // Per-channel worker snapshots for verdict checks
        channelDetails: pg.channelWorkers.map((w) => ({
          channel_name: w.channelName,
          channel_index: w.channelIndex,
          sent: w.sent,
          received: w.received,
          lost: w.tracker.totalLost(),
          duplicated: w.tracker.totalDuplicates(),
          corrupted: w.corrupted,
          errors: w.errors,
          loss_pct: w.sent > 0 ? (w.tracker.totalLost() / w.sent) * 100 : 0,
        })),
      };
      snapshots.set(name, snap);
    }
    return snapshots;
  }

  private buildSummary(cfg: Config, status = 'running'): Record<string, any> {
    const refTime = this.testStarted > 0 ? this.testStarted : this.started;
    const endTime = this.producersStopped > 0 ? this.producersStopped : performance.now();
    const elapsed = (endTime - refTime) / 1000;
    const patterns: Record<string, any> = {};

    for (const [name, pg] of this.patternGroups) {
      const pc = pg.patternConfig;
      const isRpc = pg.isRpc;

      // Use snapshot values if available (taken at producer-stop time T2),
      // otherwise fall back to live values.
      const psnap = this.producerStopSnapshot?.get(name);

      const sent = psnap ? psnap.sent : pg.totalSent();
      const received = psnap ? psnap.received : pg.totalReceived();
      const lost = psnap ? psnap.lost : pg.totalLost();
      const duplicated = psnap ? psnap.duplicated : pg.totalDuplicated();
      const corrupted = psnap ? psnap.corrupted : pg.totalCorrupted();
      const outOfOrder = psnap ? psnap.outOfOrder : pg.totalOutOfOrder();
      const errors = psnap ? psnap.errors : pg.totalErrors();
      const reconnections = psnap ? psnap.reconnections : pg.totalReconnections();
      const downtimeSeconds = psnap ? psnap.downtimeSeconds : pg.maxDowntimeSeconds();
      const bytesSent = psnap ? psnap.bytesSent : pg.totalBytesSent();
      const bytesReceived = psnap ? psnap.bytesReceived : pg.totalBytesReceived();
      const peakRateVal = psnap ? psnap.peakRate : pg.peakRate();
      const latP50 = psnap ? psnap.latencyP50 : pg.patternLatencyAccum.percentileMs(50);
      const latP95 = psnap ? psnap.latencyP95 : pg.patternLatencyAccum.percentileMs(95);
      const latP99 = psnap ? psnap.latencyP99 : pg.patternLatencyAccum.percentileMs(99);
      const latP999 = psnap ? psnap.latencyP999 : pg.patternLatencyAccum.percentileMs(99.9);

      const lossPct = sent > 0 ? (lost / sent) * 100 : 0;
      const avgTp = elapsed > 0 ? sent / elapsed : 0;

      const ps: Record<string, any> = {
        enabled: true,
        status: this.patternStates[name] ?? 'unknown',
        channels: pc.channels,
        sent,
        received,
        lost,
        duplicated,
        corrupted,
        out_of_order: outOfOrder,
        loss_pct: lossPct,
        errors,
        reconnections,
        downtime_seconds: downtimeSeconds,
        latency_p50_ms: latP50,
        latency_p95_ms: latP95,
        latency_p99_ms: latP99,
        latency_p999_ms: latP999,
        latency: {
          p50_ms: latP50,
          p95_ms: latP95,
          p99_ms: latP99,
          p999_ms: latP999,
        },
        avg_rate: avgTp,
        avg_throughput_msgs_sec: avgTp,
        peak_rate: peakRateVal,
        peak_throughput_msgs_sec: peakRateVal,
        target_rate: pg.targetRate,
        bytes_sent: bytesSent,
        bytes_received: bytesReceived,
      };

      if (isRpc) {
        ps.senders_per_channel = pc.senders_per_channel;
        ps.responders_per_channel = pc.responders_per_channel;
        ps.responses_success = psnap ? psnap.rpcSuccess : pg.totalRpcSuccess();
        ps.responses_timeout = psnap ? psnap.rpcTimeout : pg.totalRpcTimeout();
        ps.responses_error = psnap ? psnap.rpcError : pg.totalRpcError();
        ps.rpc_p50_ms = latP50;
        ps.rpc_p95_ms = latP95;
        ps.rpc_p99_ms = latP99;
        ps.rpc_p999_ms = latP999;
        if (elapsed > 0) ps.avg_throughput_rpc_sec = ps.responses_success / elapsed;
      } else {
        ps.producers_per_channel = pc.producers_per_channel;
        ps.consumers_per_channel = pc.consumers_per_channel;
        if (['events', 'events_store'].includes(name)) {
          ps.consumer_group = pc.consumer_group;
          ps.num_consumers = pc.consumers_per_channel;
        } else {
          ps.consumer_group = false;
          ps.num_consumers = pc.consumers_per_channel;
        }
      }

      // Per-channel detail for verdict checks (use snapshot if available)
      if (psnap?.channelDetails) {
        ps._channel_details = psnap.channelDetails;
      } else {
        ps._channel_details = pg.channelWorkers.map((w) => ({
          channel_name: w.channelName,
          channel_index: w.channelIndex,
          sent: w.sent,
          received: w.received,
          lost: w.tracker.totalLost(),
          duplicated: w.tracker.totalDuplicates(),
          corrupted: w.corrupted,
          errors: w.errors,
          loss_pct: w.sent > 0 ? (w.tracker.totalLost() / w.sent) * 100 : 0,
        }));
      }

      patterns[name] = ps;
    }

    const baseline = this.baselineRss || Math.max(this.peakRss, 1);
    const peak = this.peakRss || this.getRssMb();
    const growth = baseline > 0 ? peak / baseline : 1;

    let version = cfg.output.sdk_version;
    if (!version) {
      try {
        const pkg = require('kubemq-js/package.json');
        version = pkg.version;
      } catch {
        version = 'unknown';
      }
    }

    return {
      run_id: this._runId,
      sdk: 'js',
      version,
      sdk_version: version,
      mode: cfg.mode,
      broker_address: this.startupCfg.broker.address,
      started_at: this._startedAt,
      ended_at: this._endedAt,
      duration_seconds: elapsed,
      all_patterns_enabled: ALL_PATTERNS.every((p) => cfg.patterns[p]?.enabled !== false),
      warmup_active: this.warmupActive,
      status,
      patterns,
      resources: {
        peak_rss_mb: peak,
        baseline_rss_mb: baseline,
        memory_growth_factor: growth,
        peak_workers: this.peakWorkers,
      },
    };
  }

  private buildPatternsResponse(): Record<string, any> {
    const cfg = this._runCfg;
    if (!cfg) return {};
    const result: Record<string, any> = {};
    const refTime = this.testStarted > 0 ? this.testStarted : this.started;
    const elapsed = refTime > 0 ? (performance.now() - refTime) / 1000 : 0;

    for (const [name, pc] of Object.entries(cfg.patterns)) {
      if (!pc.enabled) {
        result[name] = { enabled: false };
        continue;
      }
      const pg = this.patternGroups.get(name);
      if (!pg) {
        result[name] = { enabled: true, state: this.patternStates[name] ?? 'stopped' };
        continue;
      }

      const isRpc = pg.isRpc;
      const sent = pg.totalSent();
      const received = pg.totalReceived();
      const lost = pg.totalLost();
      const lossPct = sent > 0 ? (lost / sent) * 100 : 0;

      // Use aggregate sliding rate
      let slidingRateSum = 0;
      for (const w of pg.channelWorkers) slidingRateSum += w.slidingRate.rate();
      const liveRate = slidingRateSum > 0 ? slidingRateSum : elapsed > 0 ? sent / elapsed : 0;

      const entry: Record<string, any> = {
        enabled: true,
        state: this.patternStates[name] ?? 'stopped',
        channels: pc.channels,
        sent,
        errors: pg.totalErrors(),
        reconnections: pg.totalReconnections(),
        target_rate: pg.targetRate,
        actual_rate: Number(liveRate.toFixed(1)),
        peak_rate: Number(pg.peakRate().toFixed(1)),
        bytes_sent: 0,
        bytes_received: 0,
      };

      if (isRpc) {
        entry.senders_per_channel = pc.senders_per_channel;
        entry.responders_per_channel = pc.responders_per_channel;
        entry.responses_success = pg.totalRpcSuccess();
        entry.responses_timeout = pg.totalRpcTimeout();
        entry.responses_error = pg.totalRpcError();
        entry.latency = {
          p50_ms: pg.patternLatencyAccum.percentileMs(50),
          p95_ms: pg.patternLatencyAccum.percentileMs(95),
          p99_ms: pg.patternLatencyAccum.percentileMs(99),
          p999_ms: pg.patternLatencyAccum.percentileMs(99.9),
        };
      } else {
        entry.producers_per_channel = pc.producers_per_channel;
        entry.consumers_per_channel = pc.consumers_per_channel;
        if (['events', 'events_store'].includes(name)) {
          entry.consumer_group = pc.consumer_group;
        }
        entry.received = received;
        entry.lost = lost;
        entry.duplicated = pg.totalDuplicated();
        entry.corrupted = pg.totalCorrupted();
        entry.out_of_order = pg.totalOutOfOrder();
        entry.loss_pct = Number(lossPct.toFixed(4));
        entry.latency = {
          p50_ms: pg.patternLatencyAccum.percentileMs(50),
          p95_ms: pg.patternLatencyAccum.percentileMs(95),
          p99_ms: pg.patternLatencyAccum.percentileMs(99),
          p999_ms: pg.patternLatencyAccum.percentileMs(99.9),
        };
      }

      result[name] = entry;
    }
    return result;
  }

  private buildResourcesLive(): Record<string, any> {
    const rss = this.getRssMb();
    const baseline = this.baselineRss || rss;
    const growth = baseline > 0 ? rss / baseline : 1;
    const handles = (process as any)._getActiveHandles?.()?.length ?? 0;
    return {
      rss_mb: Number(rss.toFixed(1)),
      baseline_rss_mb: Number(baseline.toFixed(1)),
      memory_growth_factor: Number(growth.toFixed(2)),
      active_workers: handles,
    };
  }

  private printBanner(cfg: Config): void {
    console.log('='.repeat(67));
    console.log('  KUBEMQ BURN-IN TEST — JS SDK (v2 multi-channel)');
    console.log('='.repeat(67));
    console.log(`  Mode:     ${cfg.mode}`);
    console.log(`  Broker:   ${this.startupCfg.broker.address}`);
    console.log(`  Duration: ${cfg.duration}`);
    console.log(`  Run ID:   ${cfg.run_id}`);
    const enabledPatterns: string[] = [];
    let totalChannels = 0;
    for (const [name, pc] of Object.entries(cfg.patterns)) {
      if (!pc.enabled) continue;
      enabledPatterns.push(`${name}(${pc.channels}ch)`);
      totalChannels += pc.channels;
    }
    console.log(`  Patterns: ${enabledPatterns.join(', ')}`);
    console.log(`  Total channels: ${totalChannels}`);
    console.log('='.repeat(67));
    console.log();
  }

  private getElapsed(): number {
    const refTime = this.testStarted > 0 ? this.testStarted : this.started;
    return refTime > 0 ? (performance.now() - refTime) / 1000 : 0;
  }

  private getRssMb(): number {
    return process.memoryUsage().rss / (1024 * 1024);
  }

  private delay(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      if (signal) {
        const onAbort = () => {
          clearTimeout(timer);
          resolve();
        };
        signal.addEventListener('abort', onAbort, { once: true });
      }
    });
  }
}

function formatDuration(secs: number): string {
  const s = Math.floor(secs);
  if (s >= 3600) return `${Math.floor(s / 3600)}h${Math.floor((s % 3600) / 60)}m${s % 60}s`;
  if (s >= 60) return `${Math.floor(s / 60)}m${s % 60}s`;
  return `${s}s`;
}

export async function cleanupOnly(cfg: Config): Promise<void> {
  const e = new Engine(cfg);
  const result = await e.cleanupChannels();
  console.log(result.message);
}
