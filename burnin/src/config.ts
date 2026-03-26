/**
 * Configuration v2: Multi-channel patterns, YAML loading, API config translation.
 * v1 config (rates, concurrency, enabled_patterns, BURNIN_* env vars) removed.
 */
import { readFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import * as yaml from 'js-yaml';

export function parseDuration(s: string): number {
  if (!s || s === '0' || s === '0s') return 0;
  s = s.trim();
  const m: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  for (const [suffix, mult] of Object.entries(m)) {
    if (s.endsWith(suffix)) {
      const n = parseFloat(s.slice(0, -suffix.length));
      return isNaN(n) ? 0 : n * mult;
    }
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// --- v2 interfaces ---

export interface ThresholdsConfig {
  max_loss_pct: number;
  max_events_loss_pct: number;
  max_duplication_pct: number;
  max_p99_latency_ms: number;
  max_p999_latency_ms: number;
  min_throughput_pct: number;
  max_error_rate_pct: number;
  max_memory_growth_factor: number;
  max_downtime_pct: number;
  max_duration: string;
}

export interface PatternConfig {
  enabled: boolean;
  channels: number;
  producers_per_channel: number;
  consumers_per_channel: number;
  consumer_group: boolean;
  senders_per_channel: number;
  responders_per_channel: number;
  rate: number;
  thresholds?: Partial<ThresholdsConfig>;
}

export interface WarmupConfig {
  max_parallel_channels: number;
  timeout_per_channel_ms: number;
  warmup_duration: string;
}

export interface Config {
  version: string;
  broker: { address: string; client_id_prefix: string };
  mode: string;
  duration: string;
  run_id: string;
  patterns: Record<string, PatternConfig>;
  queue: {
    poll_max_messages: number;
    poll_wait_timeout_seconds: number;
    auto_ack: boolean;
    max_depth: number;
  };
  rpc: { timeout_ms: number };
  message: {
    size_mode: string;
    size_bytes: number;
    size_distribution: string;
    reorder_window: number;
  };
  metrics: { port: number; report_interval: string };
  logging: { format: string; level: string };
  forced_disconnect: { interval: string; duration: string };
  recovery: {
    reconnect_interval: string;
    reconnect_max_interval: string;
    reconnect_multiplier: number;
  };
  shutdown: { drain_timeout_seconds: number; cleanup_channels: boolean };
  output: { report_file: string; sdk_version: string };
  thresholds: ThresholdsConfig;
  warmup: WarmupConfig;
  starting_timeout_seconds: number;
  cors_origins: string;
}

const ALL_PATTERN_NAMES = [
  'events',
  'events_store',
  'queue_stream',
  'queue_simple',
  'commands',
  'queries',
] as const;

const PUBSUB_QUEUE_PATTERNS = ['events', 'events_store', 'queue_stream', 'queue_simple'];
const RPC_PATTERNS = ['commands', 'queries'];

function defaultPatternConfig(pattern: string): PatternConfig {
  const isRpc = RPC_PATTERNS.includes(pattern);
  const defaultRate = pattern === 'queue_stream' ? 50 : 100;
  return {
    enabled: true,
    channels: 1,
    producers_per_channel: isRpc ? 1 : 1,
    consumers_per_channel: isRpc ? 1 : 1,
    consumer_group: false,
    senders_per_channel: isRpc ? 1 : 1,
    responders_per_channel: isRpc ? 1 : 1,
    rate: defaultRate,
  };
}

function defaultPatterns(): Record<string, PatternConfig> {
  const patterns: Record<string, PatternConfig> = {};
  for (const p of ALL_PATTERN_NAMES) {
    patterns[p] = defaultPatternConfig(p);
  }
  return patterns;
}

const DEFAULTS: Config = {
  version: '2',
  broker: { address: 'localhost:50000', client_id_prefix: 'burnin-js' },
  mode: 'soak',
  duration: '1h',
  run_id: '',
  patterns: defaultPatterns(),
  queue: {
    poll_max_messages: 10,
    poll_wait_timeout_seconds: 5,
    auto_ack: false,
    max_depth: 1_000_000,
  },
  rpc: { timeout_ms: 5000 },
  message: {
    size_mode: 'fixed',
    size_bytes: 1024,
    size_distribution: '256:80,4096:15,65536:5',
    reorder_window: 10_000,
  },
  metrics: { port: 8888, report_interval: '30s' },
  logging: { format: 'text', level: 'info' },
  forced_disconnect: { interval: '0', duration: '5s' },
  recovery: { reconnect_interval: '1s', reconnect_max_interval: '30s', reconnect_multiplier: 2.0 },
  shutdown: { drain_timeout_seconds: 10, cleanup_channels: true },
  output: { report_file: '', sdk_version: '' },
  thresholds: {
    max_loss_pct: 0,
    max_events_loss_pct: 5,
    max_duplication_pct: 0.1,
    max_p99_latency_ms: 1000,
    max_p999_latency_ms: 5000,
    min_throughput_pct: 90,
    max_error_rate_pct: 1,
    max_memory_growth_factor: 2,
    max_downtime_pct: 10,
    max_duration: '168h',
  },
  warmup: {
    max_parallel_channels: 10,
    timeout_per_channel_ms: 5000,
    warmup_duration: '',
  },
  starting_timeout_seconds: 60,
  cors_origins: '*',
};

/** Find config file: env var > CLI > auto-discover */
function findConfigFile(cliPath: string): string {
  const envPath = process.env.BURNIN_CONFIG_FILE;
  if (envPath) return envPath;
  if (cliPath) return cliPath;
  for (const candidate of ['./burnin-config.yaml', '/etc/burnin/config.yaml']) {
    if (existsSync(candidate)) return candidate;
  }
  return '';
}

function mergePatternConfig(dst: PatternConfig, src: Record<string, unknown>): void {
  if (src.enabled !== undefined) dst.enabled = Boolean(src.enabled);
  if (src.channels !== undefined) dst.channels = Number(src.channels);
  if (src.producers_per_channel !== undefined)
    dst.producers_per_channel = Number(src.producers_per_channel);
  if (src.consumers_per_channel !== undefined)
    dst.consumers_per_channel = Number(src.consumers_per_channel);
  if (src.consumer_group !== undefined) dst.consumer_group = Boolean(src.consumer_group);
  if (src.senders_per_channel !== undefined)
    dst.senders_per_channel = Number(src.senders_per_channel);
  if (src.responders_per_channel !== undefined)
    dst.responders_per_channel = Number(src.responders_per_channel);
  if (src.rate !== undefined) dst.rate = Number(src.rate);
  if (
    src.thresholds !== undefined &&
    typeof src.thresholds === 'object' &&
    src.thresholds !== null
  ) {
    dst.thresholds = { ...dst.thresholds, ...(src.thresholds as Partial<ThresholdsConfig>) };
  }
}

function mergeYamlConfig(cfg: Config, raw: Record<string, unknown>): string[] {
  const warnings: string[] = [];

  // Top-level scalars
  if (raw.version !== undefined) cfg.version = String(raw.version);
  if (raw.mode !== undefined) cfg.mode = String(raw.mode);
  if (raw.duration !== undefined) cfg.duration = String(raw.duration);
  if (raw.run_id !== undefined) cfg.run_id = String(raw.run_id);

  // Broker
  if (raw.broker && typeof raw.broker === 'object') {
    const b = raw.broker as Record<string, unknown>;
    if (b.address !== undefined) cfg.broker.address = String(b.address);
    if (b.client_id_prefix !== undefined) cfg.broker.client_id_prefix = String(b.client_id_prefix);
    if (b.tls !== undefined) {
      /* tls config accepted but not used in JS SDK */
    }
    if (b.auth_token !== undefined) {
      /* auth_token accepted but not used in JS SDK */
    }
  }

  // Patterns
  if (raw.patterns && typeof raw.patterns === 'object') {
    const pats = raw.patterns as Record<string, unknown>;
    for (const name of ALL_PATTERN_NAMES) {
      if (pats[name] && typeof pats[name] === 'object') {
        mergePatternConfig(cfg.patterns[name], pats[name] as Record<string, unknown>);
      }
    }
  }

  // Thresholds
  if (raw.thresholds && typeof raw.thresholds === 'object') {
    const t = raw.thresholds as Record<string, unknown>;
    for (const k of Object.keys(t)) {
      if (k in cfg.thresholds) {
        (cfg.thresholds as unknown as Record<string, unknown>)[k] = t[k];
      }
    }
  }

  // Message
  if (raw.message && typeof raw.message === 'object') {
    const m = raw.message as Record<string, unknown>;
    if (m.size_bytes !== undefined) cfg.message.size_bytes = Number(m.size_bytes);
    if (m.size_mode !== undefined) cfg.message.size_mode = String(m.size_mode);
    if (m.size_distribution !== undefined)
      cfg.message.size_distribution = String(m.size_distribution);
    if (m.reorder_window !== undefined) cfg.message.reorder_window = Number(m.reorder_window);
  }

  // Queue
  if (raw.queue && typeof raw.queue === 'object') {
    const q = raw.queue as Record<string, unknown>;
    if (q.max_depth !== undefined) cfg.queue.max_depth = Number(q.max_depth);
    if (q.poll_wait_seconds !== undefined)
      cfg.queue.poll_wait_timeout_seconds = Number(q.poll_wait_seconds);
    if (q.poll_max_messages !== undefined)
      cfg.queue.poll_max_messages = Number(q.poll_max_messages);
    if (q.poll_wait_timeout_seconds !== undefined)
      cfg.queue.poll_wait_timeout_seconds = Number(q.poll_wait_timeout_seconds);
    if (q.auto_ack !== undefined) cfg.queue.auto_ack = Boolean(q.auto_ack);
  }

  // RPC
  if (raw.rpc && typeof raw.rpc === 'object') {
    const r = raw.rpc as Record<string, unknown>;
    if (r.timeout_ms !== undefined) cfg.rpc.timeout_ms = Number(r.timeout_ms);
  }

  // Forced disconnect
  if (raw.forced_disconnect && typeof raw.forced_disconnect === 'object') {
    const fd = raw.forced_disconnect as Record<string, unknown>;
    if (fd.interval !== undefined) cfg.forced_disconnect.interval = String(fd.interval);
    if (fd.duration !== undefined) cfg.forced_disconnect.duration = String(fd.duration);
  }

  // Warmup
  if (raw.warmup && typeof raw.warmup === 'object') {
    const w = raw.warmup as Record<string, unknown>;
    if (w.max_parallel_channels !== undefined)
      cfg.warmup.max_parallel_channels = Number(w.max_parallel_channels);
    if (w.timeout_per_channel_ms !== undefined)
      cfg.warmup.timeout_per_channel_ms = Number(w.timeout_per_channel_ms);
    if (w.warmup_duration !== undefined) cfg.warmup.warmup_duration = String(w.warmup_duration);
  }

  // Shutdown
  if (raw.shutdown && typeof raw.shutdown === 'object') {
    const s = raw.shutdown as Record<string, unknown>;
    if (s.drain_timeout_seconds !== undefined)
      cfg.shutdown.drain_timeout_seconds = Number(s.drain_timeout_seconds);
    if (s.cleanup_channels !== undefined)
      cfg.shutdown.cleanup_channels = Boolean(s.cleanup_channels);
  }

  // API
  if (raw.api && typeof raw.api === 'object') {
    const a = raw.api as Record<string, unknown>;
    if (a.port !== undefined) cfg.metrics.port = Number(a.port);
    if (a.enabled !== undefined) {
      /* accepted but always enabled */
    }
  }

  // Output
  if (raw.output && typeof raw.output === 'object') {
    const o = raw.output as Record<string, unknown>;
    if (o.report_file !== undefined) cfg.output.report_file = String(o.report_file);
    if (o.sdk_version !== undefined) cfg.output.sdk_version = String(o.sdk_version);
    if (o.logging && typeof o.logging === 'object') {
      const l = o.logging as Record<string, unknown>;
      if (l.format !== undefined) cfg.logging.format = String(l.format);
      if (l.level !== undefined) cfg.logging.level = String(l.level);
    }
  }

  // Logging (top-level)
  if (raw.logging && typeof raw.logging === 'object') {
    const l = raw.logging as Record<string, unknown>;
    if (l.format !== undefined) cfg.logging.format = String(l.format);
    if (l.level !== undefined) cfg.logging.level = String(l.level);
  }

  // Metrics
  if (raw.metrics && typeof raw.metrics === 'object') {
    const m = raw.metrics as Record<string, unknown>;
    if (m.port !== undefined) cfg.metrics.port = Number(m.port);
    if (m.report_interval !== undefined) cfg.metrics.report_interval = String(m.report_interval);
  }

  // Recovery
  if (raw.recovery && typeof raw.recovery === 'object') {
    const r = raw.recovery as Record<string, unknown>;
    if (r.reconnect_interval !== undefined)
      cfg.recovery.reconnect_interval = String(r.reconnect_interval);
    if (r.reconnect_max_interval !== undefined)
      cfg.recovery.reconnect_max_interval = String(r.reconnect_max_interval);
    if (r.reconnect_multiplier !== undefined)
      cfg.recovery.reconnect_multiplier = Number(r.reconnect_multiplier);
  }

  if (raw.starting_timeout_seconds !== undefined)
    cfg.starting_timeout_seconds = Number(raw.starting_timeout_seconds);
  if (raw.cors_origins !== undefined) cfg.cors_origins = String(raw.cors_origins);

  return warnings;
}

export function loadConfig(cliPath: string): { config: Config; warnings: string[] } {
  const configPath = findConfigFile(cliPath);
  const cfg = JSON.parse(JSON.stringify(DEFAULTS)) as Config;
  let warnings: string[] = [];

  if (configPath && existsSync(configPath)) {
    const raw = yaml.load(readFileSync(configPath, 'utf8')) as Record<string, unknown> | null;
    if (raw) warnings = mergeYamlConfig(cfg, raw);
  }

  // Environment variable override for broker address
  const envAddr = process.env.KUBEMQ_BROKER_ADDRESS;
  if (envAddr) cfg.broker.address = envAddr;

  if (!cfg.run_id) cfg.run_id = randomBytes(4).toString('hex');
  if (cfg.mode === 'benchmark' && !cfg.warmup.warmup_duration) cfg.warmup.warmup_duration = '60s';

  return { config: cfg, warnings };
}

export function validateConfig(cfg: Config): string[] {
  const errors: string[] = [];
  if (!cfg.broker.address) errors.push('broker.address is required');
  if (!['soak', 'benchmark'].includes(cfg.mode))
    errors.push(`mode must be 'soak' or 'benchmark', got '${cfg.mode}'`);
  if (durationSec(cfg.duration) <= 0) errors.push('duration must be > 0');
  if (!['fixed', 'distribution'].includes(cfg.message.size_mode))
    errors.push(`message.size_mode must be 'fixed' or 'distribution'`);
  if (cfg.message.size_mode === 'fixed' && cfg.message.size_bytes < 64)
    errors.push(`message.size_bytes: must be >= 64, got ${cfg.message.size_bytes}`);
  if (cfg.metrics.port <= 0 || cfg.metrics.port > 65535)
    errors.push(`api.port: must be 1-65535, got ${cfg.metrics.port}`);
  if (cfg.rpc.timeout_ms <= 0) errors.push('rpc.timeout_ms must be > 0');
  if (cfg.queue.poll_wait_timeout_seconds <= 0)
    errors.push('queue.poll_wait_timeout_seconds must be > 0');
  if (cfg.shutdown.drain_timeout_seconds <= 0)
    errors.push(
      `shutdown.drain_timeout_seconds: must be > 0, got ${cfg.shutdown.drain_timeout_seconds}`,
    );

  // Validate patterns exist and at least one is enabled
  const enabledCount = Object.values(cfg.patterns).filter((p) => p.enabled).length;
  if (enabledCount === 0) errors.push('at least one pattern must be enabled');

  // Resource guard calculations
  const resourceWarnings = computeResourceWarnings(cfg);
  for (const w of resourceWarnings) {
    errors.push(`WARNING: ${w}`);
  }

  return errors;
}

export function validateRunConfig(cfg: Config): string[] {
  const errors: string[] = [];

  if (!['soak', 'benchmark'].includes(cfg.mode))
    errors.push(`mode: must be 'soak' or 'benchmark', got '${cfg.mode}'`);
  if (cfg.mode === 'soak' && cfg.duration !== '0' && durationSec(cfg.duration) <= 0)
    errors.push(`duration must be > 0 for soak mode`);

  const enabledCount = Object.values(cfg.patterns).filter((p) => p.enabled).length;
  if (enabledCount === 0) errors.push('at least one pattern must be enabled');

  for (const [name, pc] of Object.entries(cfg.patterns)) {
    if (!pc.enabled) continue;

    // channels
    if (!Number.isInteger(pc.channels) || pc.channels < 1 || pc.channels > 1000)
      errors.push(`${name}.channels: must be 1-1000, got ${pc.channels}`);

    // rate
    if (pc.rate < 0) errors.push(`${name}.rate: must be >= 0, got ${pc.rate}`);
    if (cfg.mode === 'soak' && pc.rate <= 0 && pc.rate !== 0)
      errors.push(`patterns.${name}.rate: must be > 0 for soak mode, got ${pc.rate}`);

    if (PUBSUB_QUEUE_PATTERNS.includes(name)) {
      if (pc.producers_per_channel < 1)
        errors.push(`${name}.producers_per_channel: must be >= 1, got ${pc.producers_per_channel}`);
      if (pc.producers_per_channel > 100)
        errors.push(
          `WARNING: ${name}.producers_per_channel: ${pc.producers_per_channel} exceeds recommended max 100`,
        );
      if (pc.consumers_per_channel < 1)
        errors.push(`${name}.consumers_per_channel: must be >= 1, got ${pc.consumers_per_channel}`);
      if (pc.consumers_per_channel > 100)
        errors.push(
          `WARNING: ${name}.consumers_per_channel: ${pc.consumers_per_channel} exceeds recommended max 100`,
        );
    }

    if (RPC_PATTERNS.includes(name)) {
      if (pc.senders_per_channel < 1)
        errors.push(`${name}.senders_per_channel: must be >= 1, got ${pc.senders_per_channel}`);
      if (pc.responders_per_channel < 1)
        errors.push(
          `${name}.responders_per_channel: must be >= 1, got ${pc.responders_per_channel}`,
        );
    }

    // consumer_group must be boolean (only events/events_store)
    if (['events', 'events_store'].includes(name) && typeof pc.consumer_group !== 'boolean')
      errors.push(`${name}.consumer_group: must be boolean`);

    // Pattern-level threshold validation
    if (pc.thresholds) {
      const pt = pc.thresholds;
      if (pt.max_loss_pct !== undefined && (pt.max_loss_pct < 0 || pt.max_loss_pct > 100))
        errors.push(
          `patterns.${name}.thresholds.max_loss_pct: must be 0-100, got ${pt.max_loss_pct}`,
        );
      if (
        pt.max_duplication_pct !== undefined &&
        (pt.max_duplication_pct < 0 || pt.max_duplication_pct > 100)
      )
        errors.push(
          `patterns.${name}.thresholds.max_duplication_pct: must be 0-100, got ${pt.max_duplication_pct}`,
        );
      if (pt.max_p99_latency_ms !== undefined && pt.max_p99_latency_ms <= 0)
        errors.push(
          `patterns.${name}.thresholds.max_p99_latency_ms: must be > 0, got ${pt.max_p99_latency_ms}`,
        );
      if (pt.max_p999_latency_ms !== undefined && pt.max_p999_latency_ms <= 0)
        errors.push(
          `patterns.${name}.thresholds.max_p999_latency_ms: must be > 0, got ${pt.max_p999_latency_ms}`,
        );
    }
  }

  // Global threshold validation
  for (const f of ['max_duplication_pct', 'max_error_rate_pct', 'max_downtime_pct'] as const) {
    const v = (cfg.thresholds as unknown as Record<string, number>)[f];
    if (v < 0 || v > 100) errors.push(`thresholds.${f}: must be 0-100, got ${v}`);
  }
  if (cfg.thresholds.min_throughput_pct <= 0 || cfg.thresholds.min_throughput_pct > 100)
    errors.push(
      `thresholds.min_throughput_pct: must be > 0 and <= 100, got ${cfg.thresholds.min_throughput_pct}`,
    );

  if (cfg.thresholds.max_loss_pct < 0 || cfg.thresholds.max_loss_pct > 100)
    errors.push(`thresholds.max_loss_pct: must be 0-100, got ${cfg.thresholds.max_loss_pct}`);
  if (cfg.thresholds.max_events_loss_pct < 0 || cfg.thresholds.max_events_loss_pct > 100)
    errors.push(
      `thresholds.max_events_loss_pct: must be 0-100, got ${cfg.thresholds.max_events_loss_pct}`,
    );
  if (cfg.thresholds.max_p99_latency_ms <= 0)
    errors.push(`thresholds.max_p99_latency_ms: must be > 0`);
  if (cfg.thresholds.max_p999_latency_ms <= 0)
    errors.push(`thresholds.max_p999_latency_ms: must be > 0`);
  if (cfg.thresholds.max_memory_growth_factor < 1.0)
    errors.push(`thresholds.max_memory_growth_factor: must be >= 1.0`);

  if (cfg.message.size_bytes < 64)
    errors.push(`message.size_bytes: must be >= 64, got ${cfg.message.size_bytes}`);
  if (cfg.starting_timeout_seconds <= 0)
    errors.push(`starting_timeout_seconds: must be > 0, got ${cfg.starting_timeout_seconds}`);
  if (cfg.shutdown.drain_timeout_seconds <= 0)
    errors.push(
      `shutdown.drain_timeout_seconds: must be > 0, got ${cfg.shutdown.drain_timeout_seconds}`,
    );

  // Resource guard warnings
  const resourceWarnings = computeResourceWarnings(cfg);
  for (const w of resourceWarnings) {
    console.warn(`WARNING: ${w}`);
  }

  return errors.filter((e) => !e.startsWith('WARNING:'));
}

function computeResourceWarnings(cfg: Config): string[] {
  const warnings: string[] = [];

  let totalWorkers = 0;
  for (const [name, pc] of Object.entries(cfg.patterns)) {
    if (!pc.enabled) continue;
    if (RPC_PATTERNS.includes(name)) {
      totalWorkers += pc.channels * (pc.senders_per_channel + pc.responders_per_channel);
    } else {
      totalWorkers += pc.channels * (pc.producers_per_channel + pc.consumers_per_channel);
    }
  }
  if (totalWorkers > 500) {
    warnings.push(`high worker count: ${totalWorkers} -- may impact system resources`);
  }

  // Memory estimate
  const reorderWindow = cfg.message.reorder_window;
  const estMemoryMb = totalWorkers * ((reorderWindow * 8) / 1024 / 1024 + 0.5);
  if (estMemoryMb > 4096) {
    warnings.push(
      `estimated memory: ${(estMemoryMb / 1024).toFixed(1)}GB overhead -- ensure sufficient system memory`,
    );
  }

  // Per-client type aggregate rate
  const pubSubRate =
    (cfg.patterns.events?.enabled ? cfg.patterns.events.channels * cfg.patterns.events.rate : 0) +
    (cfg.patterns.events_store?.enabled
      ? cfg.patterns.events_store.channels * cfg.patterns.events_store.rate
      : 0);
  const queuesRate =
    (cfg.patterns.queue_stream?.enabled
      ? cfg.patterns.queue_stream.channels * cfg.patterns.queue_stream.rate
      : 0) +
    (cfg.patterns.queue_simple?.enabled
      ? cfg.patterns.queue_simple.channels * cfg.patterns.queue_simple.rate
      : 0);
  const cqRate =
    (cfg.patterns.commands?.enabled
      ? cfg.patterns.commands.channels * cfg.patterns.commands.rate
      : 0) +
    (cfg.patterns.queries?.enabled ? cfg.patterns.queries.channels * cfg.patterns.queries.rate : 0);

  if (pubSubRate > 50000)
    warnings.push(
      `high aggregate rate ${pubSubRate} msgs/s through single gRPC connection -- may cause transport bottleneck`,
    );
  if (queuesRate > 50000)
    warnings.push(
      `high aggregate rate ${queuesRate} msgs/s through single gRPC connection -- may cause transport bottleneck`,
    );
  if (cqRate > 50000)
    warnings.push(
      `high aggregate rate ${cqRate} msgs/s through single gRPC connection -- may cause transport bottleneck`,
    );

  return warnings;
}

// --- v1 detection ---

export function detectV1Format(body: Record<string, unknown>): { isV1: boolean; errors: string[] } {
  const errors: string[] = [];

  // Layer 1: top-level v1 keys
  if ('concurrency' in body) errors.push('detected v1 field: concurrency -- use patterns block');
  if ('rates' in body) errors.push('detected v1 field: rates -- use patterns block');
  if ('enabled_patterns' in body)
    errors.push('detected v1 field: enabled_patterns -- use patterns block');

  // Layer 2: old field names inside patterns
  if (body.patterns && typeof body.patterns === 'object') {
    const pats = body.patterns as Record<string, unknown>;
    for (const [name, val] of Object.entries(pats)) {
      if (!val || typeof val !== 'object') continue;
      const pc = val as Record<string, unknown>;
      if ('producers' in pc && !('producers_per_channel' in pc))
        errors.push(`detected v1 field: patterns.${name}.producers -- use producers_per_channel`);
      if ('consumers' in pc && !('consumers_per_channel' in pc))
        errors.push(`detected v1 field: patterns.${name}.consumers -- use consumers_per_channel`);
      if ('senders' in pc && !('senders_per_channel' in pc))
        errors.push(`detected v1 field: patterns.${name}.senders -- use senders_per_channel`);
      if ('responders' in pc && !('responders_per_channel' in pc))
        errors.push(`detected v1 field: patterns.${name}.responders -- use responders_per_channel`);
    }
  }

  return { isV1: errors.length > 0, errors };
}

// --- Duration helpers ---

export function durationSec(s: string): number {
  return parseDuration(s);
}
export function reportIntervalSec(cfg: Config): number {
  return parseDuration(cfg.metrics.report_interval);
}
export function warmupDurationSec(cfg: Config): number {
  return parseDuration(cfg.warmup.warmup_duration);
}
export function forcedDisconnectIntervalSec(cfg: Config): number {
  return parseDuration(cfg.forced_disconnect.interval);
}
export function forcedDisconnectDurationSec(cfg: Config): number {
  return parseDuration(cfg.forced_disconnect.duration);
}
export function reconnectIntervalMs(cfg: Config): number {
  return parseDuration(cfg.recovery.reconnect_interval) * 1000;
}
export function reconnectMaxIntervalMs(cfg: Config): number {
  return parseDuration(cfg.recovery.reconnect_max_interval) * 1000;
}
export function maxDurationSec(cfg: Config): number {
  return parseDuration(cfg.thresholds.max_duration);
}

// --- Threshold helpers ---

export function getPatternLossThreshold(cfg: Config, pattern: string): number {
  const pt = cfg.patterns[pattern]?.thresholds;
  if (pt?.max_loss_pct !== undefined) return pt.max_loss_pct;
  if (pattern === 'events') return cfg.thresholds.max_events_loss_pct;
  return cfg.thresholds.max_loss_pct;
}

export function getPatternP99Threshold(cfg: Config, pattern: string): number {
  return cfg.patterns[pattern]?.thresholds?.max_p99_latency_ms ?? cfg.thresholds.max_p99_latency_ms;
}

export function getPatternP999Threshold(cfg: Config, pattern: string): number {
  return (
    cfg.patterns[pattern]?.thresholds?.max_p999_latency_ms ?? cfg.thresholds.max_p999_latency_ms
  );
}

// --- API Config Translation (v2) ---

export interface ApiPatternConfigV2 {
  enabled?: boolean;
  channels?: number;
  producers_per_channel?: number;
  consumers_per_channel?: number;
  consumer_group?: boolean;
  senders_per_channel?: number;
  responders_per_channel?: number;
  rate?: number;
  thresholds?: Partial<ThresholdsConfig>;
}

export interface ApiRunConfig {
  broker?: { address?: string };
  mode?: string;
  duration?: string;
  run_id?: string;
  starting_timeout_seconds?: number;
  patterns?: Record<string, ApiPatternConfigV2>;
  queue?: {
    poll_max_messages?: number;
    poll_wait_timeout_seconds?: number;
    auto_ack?: boolean;
    max_depth?: number;
  };
  rpc?: { timeout_ms?: number };
  message?: {
    size_mode?: string;
    size_bytes?: number;
    size_distribution?: string;
    reorder_window?: number;
  };
  thresholds?: Partial<ThresholdsConfig>;
  forced_disconnect?: { interval?: string; duration?: string };
  shutdown?: { drain_timeout_seconds?: number; cleanup_channels?: boolean };
  warmup?: Partial<WarmupConfig>;
  metrics?: { report_interval?: string };
}

export function translateApiConfig(api: ApiRunConfig, startup: Config): Config {
  const cfg = JSON.parse(JSON.stringify(startup)) as Config;

  // Broker address override from API
  if (api.broker?.address) cfg.broker.address = api.broker.address;

  if (api.mode !== undefined) cfg.mode = api.mode;
  if (api.duration !== undefined) cfg.duration = api.duration;
  if (api.run_id !== undefined && api.run_id !== '') cfg.run_id = api.run_id;
  if (api.starting_timeout_seconds !== undefined)
    cfg.starting_timeout_seconds = api.starting_timeout_seconds;

  if (api.patterns) {
    for (const [name, pc] of Object.entries(api.patterns)) {
      if (!cfg.patterns[name]) continue;
      if (pc.enabled !== undefined) cfg.patterns[name].enabled = pc.enabled;
      if (pc.channels !== undefined) cfg.patterns[name].channels = pc.channels;
      if (pc.producers_per_channel !== undefined)
        cfg.patterns[name].producers_per_channel = pc.producers_per_channel;
      if (pc.consumers_per_channel !== undefined)
        cfg.patterns[name].consumers_per_channel = pc.consumers_per_channel;
      if (pc.consumer_group !== undefined) cfg.patterns[name].consumer_group = pc.consumer_group;
      if (pc.senders_per_channel !== undefined)
        cfg.patterns[name].senders_per_channel = pc.senders_per_channel;
      if (pc.responders_per_channel !== undefined)
        cfg.patterns[name].responders_per_channel = pc.responders_per_channel;
      if (pc.rate !== undefined) cfg.patterns[name].rate = pc.rate;
      if (pc.thresholds) {
        cfg.patterns[name].thresholds = { ...cfg.patterns[name].thresholds, ...pc.thresholds };
      }
    }
  }

  if (api.queue) {
    if (api.queue.poll_max_messages !== undefined)
      cfg.queue.poll_max_messages = api.queue.poll_max_messages;
    if (api.queue.poll_wait_timeout_seconds !== undefined)
      cfg.queue.poll_wait_timeout_seconds = api.queue.poll_wait_timeout_seconds;
    if (api.queue.auto_ack !== undefined) cfg.queue.auto_ack = api.queue.auto_ack;
    if (api.queue.max_depth !== undefined) cfg.queue.max_depth = api.queue.max_depth;
  }

  if (api.rpc?.timeout_ms !== undefined) cfg.rpc.timeout_ms = api.rpc.timeout_ms;

  if (api.message) {
    if (api.message.size_mode !== undefined) cfg.message.size_mode = api.message.size_mode;
    if (api.message.size_bytes !== undefined) cfg.message.size_bytes = api.message.size_bytes;
    if (api.message.size_distribution !== undefined)
      cfg.message.size_distribution = api.message.size_distribution;
    if (api.message.reorder_window !== undefined)
      cfg.message.reorder_window = api.message.reorder_window;
  }

  if (api.thresholds) {
    for (const [k, v] of Object.entries(api.thresholds)) {
      if (v !== undefined && k in cfg.thresholds) {
        (cfg.thresholds as unknown as Record<string, unknown>)[k] = v;
      }
    }
  }

  if (api.forced_disconnect) {
    if (api.forced_disconnect.interval !== undefined)
      cfg.forced_disconnect.interval = api.forced_disconnect.interval;
    if (api.forced_disconnect.duration !== undefined)
      cfg.forced_disconnect.duration = api.forced_disconnect.duration;
  }

  if (api.shutdown) {
    if (api.shutdown.drain_timeout_seconds !== undefined)
      cfg.shutdown.drain_timeout_seconds = api.shutdown.drain_timeout_seconds;
    if (api.shutdown.cleanup_channels !== undefined)
      cfg.shutdown.cleanup_channels = api.shutdown.cleanup_channels;
  }

  if (api.warmup) {
    if (api.warmup.max_parallel_channels !== undefined)
      cfg.warmup.max_parallel_channels = api.warmup.max_parallel_channels;
    if (api.warmup.timeout_per_channel_ms !== undefined)
      cfg.warmup.timeout_per_channel_ms = api.warmup.timeout_per_channel_ms;
    if (api.warmup.warmup_duration !== undefined)
      cfg.warmup.warmup_duration = api.warmup.warmup_duration;
  }

  if (api.metrics?.report_interval !== undefined)
    cfg.metrics.report_interval = api.metrics.report_interval;

  if (!cfg.run_id) cfg.run_id = randomBytes(4).toString('hex');
  if (!cfg.warmup.warmup_duration) {
    cfg.warmup.warmup_duration = cfg.mode === 'benchmark' ? '60s' : '0s';
  }

  return cfg;
}
