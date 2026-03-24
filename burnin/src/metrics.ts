/**
 * All 26 Prometheus metrics + helper functions.
 * Metric names and labels match spec Section 7.1 exactly.
 */
import { Counter, Histogram, Gauge, Registry } from 'prom-client';

export const registry = new Registry();

const SDK = 'js';

// --- Counters ---
const messagesSent = new Counter({
  name: 'burnin_messages_sent_total',
  help: 'Total messages sent',
  labelNames: ['sdk', 'pattern', 'producer_id'] as const,
  registers: [registry],
});
const messagesReceived = new Counter({
  name: 'burnin_messages_received_total',
  help: 'Total messages received',
  labelNames: ['sdk', 'pattern', 'consumer_id'] as const,
  registers: [registry],
});
const messagesLost = new Counter({
  name: 'burnin_messages_lost_total',
  help: 'Confirmed lost messages',
  labelNames: ['sdk', 'pattern'] as const,
  registers: [registry],
});
const messagesDuplicated = new Counter({
  name: 'burnin_messages_duplicated_total',
  help: 'Duplicate messages',
  labelNames: ['sdk', 'pattern'] as const,
  registers: [registry],
});
const messagesCorrupted = new Counter({
  name: 'burnin_messages_corrupted_total',
  help: 'Corrupted messages',
  labelNames: ['sdk', 'pattern'] as const,
  registers: [registry],
});
const messagesOutOfOrder = new Counter({
  name: 'burnin_messages_out_of_order_total',
  help: 'Out-of-order messages',
  labelNames: ['sdk', 'pattern'] as const,
  registers: [registry],
});
const messagesUnconfirmed = new Counter({
  name: 'burnin_messages_unconfirmed_total',
  help: 'Unconfirmed messages',
  labelNames: ['sdk', 'pattern'] as const,
  registers: [registry],
});
const reconnDuplicates = new Counter({
  name: 'burnin_reconnection_duplicates_total',
  help: 'Post-reconnection duplicates',
  labelNames: ['sdk', 'pattern'] as const,
  registers: [registry],
});
const errors = new Counter({
  name: 'burnin_errors_total',
  help: 'Errors by type',
  labelNames: ['sdk', 'pattern', 'error_type'] as const,
  registers: [registry],
});
const reconnections = new Counter({
  name: 'burnin_reconnections_total',
  help: 'Reconnections',
  labelNames: ['sdk', 'pattern'] as const,
  registers: [registry],
});
const bytesSent = new Counter({
  name: 'burnin_bytes_sent_total',
  help: 'Bytes sent',
  labelNames: ['sdk', 'pattern'] as const,
  registers: [registry],
});
const bytesReceived = new Counter({
  name: 'burnin_bytes_received_total',
  help: 'Bytes received',
  labelNames: ['sdk', 'pattern'] as const,
  registers: [registry],
});
const rpcResponses = new Counter({
  name: 'burnin_rpc_responses_total',
  help: 'RPC responses by status',
  labelNames: ['sdk', 'pattern', 'status'] as const,
  registers: [registry],
});
const downtimeSeconds = new Counter({
  name: 'burnin_downtime_seconds_total',
  help: 'Downtime seconds',
  labelNames: ['sdk', 'pattern'] as const,
  registers: [registry],
});
const forcedDisconnects = new Counter({
  name: 'burnin_forced_disconnects_total',
  help: 'Forced disconnects',
  labelNames: ['sdk'] as const,
  registers: [registry],
});

// --- Histograms (F6: exact bucket values from spec) ---
const LATENCY_BUCKETS = [
  0.0005, 0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5,
];
const RPC_BUCKETS = [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5];

const messageLatency = new Histogram({
  name: 'burnin_message_latency_seconds',
  help: 'E2E message latency',
  labelNames: ['sdk', 'pattern'] as const,
  buckets: LATENCY_BUCKETS,
  registers: [registry],
});
const sendDuration = new Histogram({
  name: 'burnin_send_duration_seconds',
  help: 'Send duration',
  labelNames: ['sdk', 'pattern'] as const,
  buckets: LATENCY_BUCKETS,
  registers: [registry],
});
const rpcDuration = new Histogram({
  name: 'burnin_rpc_duration_seconds',
  help: 'RPC round-trip',
  labelNames: ['sdk', 'pattern'] as const,
  buckets: RPC_BUCKETS,
  registers: [registry],
});

// --- Gauges ---
const activeConnections = new Gauge({
  name: 'burnin_active_connections',
  help: 'Active connections',
  labelNames: ['sdk', 'pattern'] as const,
  registers: [registry],
});
const uptimeGauge = new Gauge({
  name: 'burnin_uptime_seconds',
  help: 'Uptime seconds',
  labelNames: ['sdk'] as const,
  registers: [registry],
});
const targetRateGauge = new Gauge({
  name: 'burnin_target_rate',
  help: 'Target rate',
  labelNames: ['sdk', 'pattern'] as const,
  registers: [registry],
});
const actualRateGauge = new Gauge({
  name: 'burnin_actual_rate',
  help: 'Actual rate',
  labelNames: ['sdk', 'pattern'] as const,
  registers: [registry],
});
const consumerLag = new Gauge({
  name: 'burnin_consumer_lag_messages',
  help: 'Consumer lag',
  labelNames: ['sdk', 'pattern'] as const,
  registers: [registry],
});
const groupBalance = new Gauge({
  name: 'burnin_consumer_group_balance_ratio',
  help: 'Group balance ratio',
  labelNames: ['sdk', 'pattern'] as const,
  registers: [registry],
});
const warmupGauge = new Gauge({
  name: 'burnin_warmup_active',
  help: 'Warmup active',
  labelNames: ['sdk'] as const,
  registers: [registry],
});
const activeWorkersGauge = new Gauge({
  name: 'burnin_active_workers',
  help: 'Active workers',
  labelNames: ['sdk'] as const,
  registers: [registry],
});

// --- Helper functions ---
export function incSent(pattern: string, producerId: string, bytes = 0): void {
  messagesSent.labels(SDK, pattern, producerId).inc();
  if (bytes > 0) bytesSent.labels(SDK, pattern).inc(bytes);
}
export function incReceived(pattern: string, consumerId: string, bytes = 0): void {
  messagesReceived.labels(SDK, pattern, consumerId).inc();
  if (bytes > 0) bytesReceived.labels(SDK, pattern).inc(bytes);
}
export function incLost(pattern: string, count = 1): void {
  messagesLost.labels(SDK, pattern).inc(count);
}
export function incDuplicated(pattern: string): void {
  messagesDuplicated.labels(SDK, pattern).inc();
}
export function incCorrupted(pattern: string): void {
  messagesCorrupted.labels(SDK, pattern).inc();
}
export function incOutOfOrder(pattern: string): void {
  messagesOutOfOrder.labels(SDK, pattern).inc();
}
export function incUnconfirmed(pattern: string): void {
  messagesUnconfirmed.labels(SDK, pattern).inc();
}
export function incReconnDuplicates(pattern: string): void {
  reconnDuplicates.labels(SDK, pattern).inc();
}
export function incError(pattern: string, errorType: string): void {
  errors.labels(SDK, pattern, errorType).inc();
}
export function incReconnections(pattern: string): void {
  reconnections.labels(SDK, pattern).inc();
}
export function incRpcResponse(pattern: string, status: string): void {
  rpcResponses.labels(SDK, pattern, status).inc();
}
export function addDowntime(pattern: string, seconds: number): void {
  if (seconds > 0) downtimeSeconds.labels(SDK, pattern).inc(seconds);
}
export function incForcedDisconnects(): void {
  forcedDisconnects.labels(SDK).inc();
}
export function observeLatency(pattern: string, seconds: number): void {
  messageLatency.labels(SDK, pattern).observe(seconds);
}
export function observeSendDuration(pattern: string, seconds: number): void {
  sendDuration.labels(SDK, pattern).observe(seconds);
}
export function observeRpcDuration(pattern: string, seconds: number): void {
  rpcDuration.labels(SDK, pattern).observe(seconds);
}
export function setActiveConnections(pattern: string, count: number): void {
  activeConnections.labels(SDK, pattern).set(count);
}
export function setUptime(seconds: number): void {
  uptimeGauge.labels(SDK).set(seconds);
}
export function setTargetRate(pattern: string, rate: number): void {
  targetRateGauge.labels(SDK, pattern).set(rate);
}
export function setActualRate(pattern: string, rate: number): void {
  actualRateGauge.labels(SDK, pattern).set(rate);
}
export function setConsumerLag(pattern: string, lag: number): void {
  consumerLag.labels(SDK, pattern).set(lag);
}
export function setGroupBalance(pattern: string, ratio: number): void {
  groupBalance.labels(SDK, pattern).set(ratio);
}
export function setWarmupActive(val: number): void {
  warmupGauge.labels(SDK).set(val);
}
export function setActiveWorkers(count: number): void {
  activeWorkersGauge.labels(SDK).set(count);
}

export function resetMetrics(): void {
  registry.resetMetrics();
}

const ALL_PATTERNS = [
  'events',
  'events_store',
  'queue_stream',
  'queue_simple',
  'commands',
  'queries',
];

export function preInitializeMetrics(): void {
  for (const p of ALL_PATTERNS) {
    messagesSent.labels(SDK, p, 'p-000').inc(0);
    messagesReceived.labels(SDK, p, 'c-000').inc(0);
    messagesLost.labels(SDK, p).inc(0);
    messagesDuplicated.labels(SDK, p).inc(0);
    messagesCorrupted.labels(SDK, p).inc(0);
    messagesOutOfOrder.labels(SDK, p).inc(0);
    messagesUnconfirmed.labels(SDK, p).inc(0);
    reconnDuplicates.labels(SDK, p).inc(0);
    errors.labels(SDK, p, 'send_failure').inc(0);
    reconnections.labels(SDK, p).inc(0);
    bytesSent.labels(SDK, p).inc(0);
    bytesReceived.labels(SDK, p).inc(0);
    downtimeSeconds.labels(SDK, p).inc(0);
    activeConnections.labels(SDK, p).set(0);
    targetRateGauge.labels(SDK, p).set(0);
    actualRateGauge.labels(SDK, p).set(0);
    consumerLag.labels(SDK, p).set(0);
    groupBalance.labels(SDK, p).set(0);
  }
  forcedDisconnects.labels(SDK).inc(0);
  uptimeGauge.labels(SDK).set(0);
  warmupGauge.labels(SDK).set(0);
  activeWorkersGauge.labels(SDK).set(0);
  for (const p of ['commands', 'queries']) {
    rpcResponses.labels(SDK, p, 'success').inc(0);
    rpcResponses.labels(SDK, p, 'timeout').inc(0);
    rpcResponses.labels(SDK, p, 'error').inc(0);
  }
}
