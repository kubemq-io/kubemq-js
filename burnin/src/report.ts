/**
 * Report generation v2: per-channel verdict checks (fail-on-any), multi-channel fields,
 * console + JSON output. Spec v2.1 compliant verdict format.
 */
import { writeFileSync } from 'node:fs';
import type { Config } from './config.js';
import {
  getPatternLossThreshold,
  getPatternP99Threshold,
  getPatternP999Threshold,
} from './config.js';

export const PASSED = 'PASSED';
export const PASSED_WITH_WARNINGS = 'PASSED_WITH_WARNINGS';
export const FAILED = 'FAILED';

export interface CheckResult {
  passed: boolean;
  threshold: string;
  actual: string;
  advisory: boolean;
}
export interface Verdict {
  result: string;
  passed: boolean;
  warnings: string[];
  checks: Record<string, CheckResult>;
}

const PUBSUB_QUEUE = ['events', 'events_store', 'queue_stream', 'queue_simple'];
const ALL_PATTERNS = [
  'events',
  'events_store',
  'queue_stream',
  'queue_simple',
  'commands',
  'queries',
];

export function generateVerdict(
  summary: Record<string, any>,
  cfg: Config,
  memoryBaselineAdvisory = false,
): Verdict {
  const patterns = summary.patterns as Record<string, Record<string, any>>;
  const resources = summary.resources as Record<string, number>;
  const durationSecs = summary.duration_seconds as number;
  const mode = cfg.mode;
  const checks: Record<string, CheckResult> = {};
  const warnings: string[] = [];
  let anyNonAdvisoryFail = false;
  let anyAdvisoryFail = false;

  const enabledPatterns = Object.entries(cfg.patterns).filter(([, pc]) => pc.enabled);
  const allEnabled = ALL_PATTERNS.every((p) => cfg.patterns[p]?.enabled !== false);
  if (!allEnabled)
    warnings.push('Not all patterns enabled -- not valid for production certification');

  function addCheck(
    name: string,
    passed: boolean,
    threshold: string,
    actual: string,
    advisory = false,
  ): void {
    checks[name] = { passed, threshold, actual, advisory };
    if (!passed) {
      if (advisory) anyAdvisoryFail = true;
      else anyNonAdvisoryFail = true;
    }
  }

  // Per-pattern: message_loss (pub/sub + queue only) -- per-channel fail-on-any
  for (const p of PUBSUB_QUEUE) {
    if (cfg.patterns[p]?.enabled === false || !patterns[p]) continue;
    const ps = patterns[p];
    const thresh = getPatternLossThreshold(cfg, p);
    const channelDetails = ps._channel_details as Array<Record<string, any>> | undefined;

    if (channelDetails && channelDetails.length > 1) {
      // Multi-channel: check each channel independently, fail if any exceeds
      let worstPct = 0;
      let worstChannel = '';
      let worstSent = 0;
      let worstLost = 0;
      let anyFail = false;

      for (const ch of channelDetails) {
        const chLossPct = ch.loss_pct ?? 0;
        if (chLossPct > worstPct) {
          worstPct = chLossPct;
          worstChannel = `ch_${String(ch.channel_index).padStart(4, '0')}`;
          worstSent = ch.sent ?? 0;
          worstLost = ch.lost ?? 0;
        }
        if (chLossPct > thresh) anyFail = true;
      }
      const actualStr = anyFail
        ? `${worstChannel}: ${worstPct.toFixed(4)}% (${worstLost}/${worstSent})`
        : `${worstPct.toFixed(4)}%`;
      addCheck(`message_loss:${p}`, !anyFail, `${thresh}%`, actualStr);
    } else {
      // Single channel
      const lossPct = ps.loss_pct ?? 0;
      addCheck(`message_loss:${p}`, lossPct <= thresh, `${thresh}%`, `${lossPct.toFixed(4)}%`);
    }
  }

  // Per-pattern: broadcast / duplication (pub/sub + queue only)
  for (const p of PUBSUB_QUEUE) {
    if (cfg.patterns[p]?.enabled === false || !patterns[p]) continue;
    const ps = patterns[p];
    const isEventPattern = p === 'events' || p === 'events_store';
    const consumerGroup = ps.consumer_group ?? false;
    const numConsumers = ps.consumers_per_channel ?? ps.num_consumers ?? 1;
    const channelDetails = ps._channel_details as Array<Record<string, any>> | undefined;

    if (isEventPattern && !consumerGroup && numConsumers > 1) {
      // Broadcast mode: arithmetic per-channel check
      if (channelDetails && channelDetails.length > 0) {
        let worstActual = '';
        let broadcastOk = true;

        for (const ch of channelDetails) {
          const chSent = ch.sent ?? 0;
          const chReceived = ch.received ?? 0;
          const expected = chSent * numConsumers;
          if (chReceived !== expected) {
            broadcastOk = false;
            const chLabel = `ch_${String(ch.channel_index).padStart(4, '0')}`;
            if (
              !worstActual ||
              chReceived < parseInt(worstActual.split('/')[0]?.split(': ')[1] ?? '0')
            ) {
              worstActual = `${chLabel}: ${chReceived}/${expected}`;
            }
          }
        }
        const totalSent = ps.sent ?? 0;
        const totalExpected = totalSent * numConsumers;
        const totalReceived = ps.received ?? 0;
        if (!worstActual) worstActual = `${totalReceived}/${totalExpected}`;
        addCheck(`broadcast:${p}`, broadcastOk, `sent\u00d7${numConsumers}`, worstActual);
      } else {
        // Fallback: aggregate check
        const sent = ps.sent ?? 0;
        const received = ps.received ?? 0;
        const expectedTotal = sent * numConsumers;
        addCheck(
          `broadcast:${p}`,
          received === expectedTotal,
          `${sent}\u00d7${numConsumers}`,
          `${received}`,
        );
      }
    } else if (isEventPattern && consumerGroup) {
      // Consumer group mode: strict 0% duplication, per-channel fail-on-any
      if (channelDetails && channelDetails.length > 1) {
        let anyFail = false;
        let worstActual = '';
        for (const ch of channelDetails) {
          const chDupPct = ch.sent > 0 ? (ch.duplicated / ch.sent) * 100 : 0;
          if (chDupPct > 0) {
            anyFail = true;
            const chLabel = `ch_${String(ch.channel_index).padStart(4, '0')}`;
            worstActual = `${chLabel}: ${chDupPct.toFixed(4)}%`;
          }
        }
        const aggDupPct = (ps.sent ?? 0) > 0 ? ((ps.duplicated ?? 0) / ps.sent) * 100 : 0;
        addCheck(`duplication:${p}`, !anyFail, '0.0%', worstActual || `${aggDupPct.toFixed(4)}%`);
      } else {
        const dupPct = (ps.sent ?? 0) > 0 ? ((ps.duplicated ?? 0) / ps.sent) * 100 : 0;
        addCheck(`duplication:${p}`, dupPct === 0, '0.0%', `${dupPct.toFixed(4)}%`);
      }
    } else {
      // Queue patterns or single-consumer: threshold-based, per-channel fail-on-any
      if (channelDetails && channelDetails.length > 1) {
        let anyFail = false;
        let worstActual = '';
        let worstPct = 0;
        for (const ch of channelDetails) {
          const chDupPct = ch.sent > 0 ? (ch.duplicated / ch.sent) * 100 : 0;
          if (chDupPct > worstPct) {
            worstPct = chDupPct;
            worstActual = `ch_${String(ch.channel_index).padStart(4, '0')}: ${chDupPct.toFixed(4)}%`;
          }
          if (chDupPct > cfg.thresholds.max_duplication_pct) anyFail = true;
        }
        const aggDupPct = (ps.sent ?? 0) > 0 ? ((ps.duplicated ?? 0) / ps.sent) * 100 : 0;
        addCheck(
          `duplication:${p}`,
          !anyFail,
          `${cfg.thresholds.max_duplication_pct}%`,
          worstActual || `${aggDupPct.toFixed(4)}%`,
        );
      } else {
        const dupPct = (ps.sent ?? 0) > 0 ? ((ps.duplicated ?? 0) / ps.sent) * 100 : 0;
        addCheck(
          `duplication:${p}`,
          dupPct <= cfg.thresholds.max_duplication_pct,
          `${cfg.thresholds.max_duplication_pct}%`,
          `${dupPct.toFixed(4)}%`,
        );
      }
    }
  }

  // Corruption (all patterns combined) -- per-channel fail if any has corruption
  let totalCorrupted = 0;
  for (const p of ALL_PATTERNS) {
    if (cfg.patterns[p]?.enabled === false || !patterns[p]) continue;
    const channelDetails = patterns[p]._channel_details as Array<Record<string, any>> | undefined;
    if (channelDetails) {
      for (const ch of channelDetails) totalCorrupted += ch.corrupted ?? 0;
    } else {
      totalCorrupted += patterns[p].corrupted ?? 0;
    }
  }
  addCheck('corruption', totalCorrupted === 0, '0', String(totalCorrupted));

  // Per-pattern: p99_latency (from pattern-level shared accumulator)
  for (const p of ALL_PATTERNS) {
    if (cfg.patterns[p]?.enabled === false || !patterns[p]) continue;
    const ps = patterns[p];
    const p99 = ['commands', 'queries'].includes(p)
      ? (ps.rpc_p99_ms ?? ps.latency?.p99_ms ?? 0)
      : (ps.latency_p99_ms ?? ps.latency?.p99_ms ?? 0);
    const thresh = getPatternP99Threshold(cfg, p);
    addCheck(`p99_latency:${p}`, p99 <= thresh, `${thresh}ms`, `${p99.toFixed(1)}ms`);
  }

  // Per-pattern: p999_latency (from pattern-level shared accumulator)
  for (const p of ALL_PATTERNS) {
    if (cfg.patterns[p]?.enabled === false || !patterns[p]) continue;
    const ps = patterns[p];
    const p999 = ['commands', 'queries'].includes(p)
      ? (ps.rpc_p999_ms ?? ps.latency?.p999_ms ?? 0)
      : (ps.latency_p999_ms ?? ps.latency?.p999_ms ?? 0);
    const thresh = getPatternP999Threshold(cfg, p);
    addCheck(`p999_latency:${p}`, p999 <= thresh, `${thresh}ms`, `${p999.toFixed(1)}ms`);
  }

  // Throughput (soak mode only): aggregate_throughput / (rate * channels) * 100
  if (mode === 'soak' && durationSecs > 0) {
    let minTp = 100;
    for (const p of ALL_PATTERNS) {
      if (cfg.patterns[p]?.enabled === false || !patterns[p]) continue;
      const ps = patterns[p];
      const target = ps.target_rate ?? 0; // Already = rate * channels
      const avgRate = ps.avg_throughput_msgs_sec ?? ps.avg_rate ?? 0;
      if (target > 0) minTp = Math.min(minTp, (avgRate / target) * 100);
    }
    addCheck(
      'throughput',
      minTp >= cfg.thresholds.min_throughput_pct,
      `${cfg.thresholds.min_throughput_pct}%`,
      `${minTp.toFixed(1)}%`,
    );
  } else {
    checks.throughput = {
      passed: true,
      threshold: 'N/A (benchmark)',
      actual: 'N/A',
      advisory: false,
    };
  }

  // Per-pattern: error_rate (aggregated across all channels)
  for (const p of ALL_PATTERNS) {
    if (cfg.patterns[p]?.enabled === false || !patterns[p]) continue;
    const ps = patterns[p];
    const sent = ps.sent ?? 0;
    const recv = ['commands', 'queries'].includes(p)
      ? (ps.responses_success ?? ps.received ?? 0)
      : (ps.received ?? 0);
    const ops = sent + recv;
    const errPct = ops > 0 ? ((ps.errors ?? 0) / ops) * 100 : 0;
    addCheck(
      `error_rate:${p}`,
      errPct <= cfg.thresholds.max_error_rate_pct,
      `${cfg.thresholds.max_error_rate_pct}%`,
      `${errPct.toFixed(4)}%`,
    );
  }

  // Memory stability (advisory for runs shorter than 5 minutes)
  const growth = resources.memory_growth_factor ?? 1;
  const maxFactor = cfg.thresholds.max_memory_growth_factor;
  addCheck(
    'memory_stability',
    growth <= maxFactor,
    `${maxFactor}x`,
    `${growth.toFixed(2)}x`,
    memoryBaselineAdvisory,
  );
  if (memoryBaselineAdvisory && growth > maxFactor) {
    warnings.push(
      'Memory stability check is advisory (run shorter than 5 minutes, baseline unreliable)',
    );
  }

  // Memory trend (advisory)
  const trendThreshold = 1.0 + (maxFactor - 1.0) * 0.5;
  const trendFail = growth > trendThreshold;
  addCheck(
    'memory_trend',
    !trendFail,
    `${trendThreshold.toFixed(1)}x`,
    `${growth.toFixed(2)}x`,
    true,
  );
  if (trendFail)
    warnings.push(
      `Memory growth trend: ${growth.toFixed(2)}x (advisory threshold: ${trendThreshold.toFixed(1)}x)`,
    );

  // Downtime -- max across all channels (not sum), since they share a connection
  let maxDowntime = 0;
  if (durationSecs > 0) {
    for (const p of ALL_PATTERNS) {
      if (cfg.patterns[p]?.enabled === false || !patterns[p]) continue;
      maxDowntime = Math.max(
        maxDowntime,
        ((patterns[p].downtime_seconds ?? 0) / durationSecs) * 100,
      );
    }
  }
  addCheck(
    'downtime',
    maxDowntime <= cfg.thresholds.max_downtime_pct,
    `${cfg.thresholds.max_downtime_pct}%`,
    `${maxDowntime.toFixed(4)}%`,
  );

  const result = anyNonAdvisoryFail ? FAILED : anyAdvisoryFail ? PASSED_WITH_WARNINGS : PASSED;
  return { result, passed: !anyNonAdvisoryFail, warnings, checks };
}

export function generateStartupErrorVerdict(errorMsg: string): Verdict {
  return {
    result: FAILED,
    passed: false,
    warnings: [],
    checks: {
      startup: { passed: false, threshold: 'success', actual: errorMsg, advisory: false },
    },
  };
}

const CHECK_LABELS: Record<string, string> = {
  corruption: 'Corruption:',
  throughput: 'Throughput:',
  memory_stability: 'Memory stability:',
  downtime: 'Downtime:',
  memory_trend: 'Memory trend:',
  startup: 'Startup:',
};

export function printConsoleReport(summary: Record<string, any>): void {
  const v = summary.verdict as Verdict;
  const patterns = summary.patterns as Record<string, Record<string, any>>;
  const res = summary.resources as Record<string, number>;
  const dur = summary.duration_seconds as number;
  const h = Math.floor(dur / 3600),
    m = Math.floor((dur % 3600) / 60),
    s = Math.floor(dur % 60);
  const durStr = h ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;

  const lines: string[] = [];
  lines.push('', '='.repeat(75));
  lines.push(
    `  KUBEMQ BURN-IN TEST REPORT -- JS SDK v${summary.version ?? summary.sdk_version} (v2 multi-channel)`,
  );
  lines.push('='.repeat(75));
  lines.push(
    `  Mode:     ${summary.mode}`,
    `  Broker:   ${summary.broker_address}`,
    `  Duration: ${durStr}`,
  );
  lines.push(`  Started:  ${fmtTs(summary.started_at)}`, `  Ended:    ${fmtTs(summary.ended_at)}`);
  lines.push('-'.repeat(75));

  const hdr =
    '  ' +
    'PATTERN'.padEnd(22) +
    'SENT'.padStart(10) +
    'RECV'.padStart(10) +
    'LOST'.padStart(6) +
    'DUP'.padStart(6) +
    'ERR'.padStart(6) +
    'P99(ms)'.padStart(9) +
    'P999(ms)'.padStart(10);
  lines.push(hdr);
  let tSent = 0,
    tRecv = 0,
    tLost = 0,
    tDup = 0,
    tErr = 0;
  for (const [name, ps] of Object.entries(patterns)) {
    if (ps.enabled === false) continue;
    const sent = ps.sent ?? 0,
      recv = ps.received ?? 0,
      lost = ps.lost ?? 0,
      dup = ps.duplicated ?? 0,
      err = ps.errors ?? 0;
    tSent += sent;
    tRecv += recv;
    tLost += lost;
    tDup += dup;
    tErr += err;
    const p99 = ['commands', 'queries'].includes(name)
      ? (ps.rpc_p99_ms ?? 0)
      : (ps.latency_p99_ms ?? 0);
    const p999 = ['commands', 'queries'].includes(name)
      ? (ps.rpc_p999_ms ?? 0)
      : (ps.latency_p999_ms ?? 0);
    const channels = ps.channels ?? 1;
    const label = channels > 1 ? `${name} (${channels}ch)` : name;
    lines.push(
      '  ' +
        label.padEnd(22) +
        String(sent).padStart(10) +
        String(recv).padStart(10) +
        String(lost).padStart(6) +
        String(dup).padStart(6) +
        String(err).padStart(6) +
        p99.toFixed(1).padStart(9) +
        p999.toFixed(1).padStart(10),
    );
  }
  lines.push('-'.repeat(75));
  lines.push(
    '  ' +
      'TOTALS'.padEnd(22) +
      String(tSent).padStart(10) +
      String(tRecv).padStart(10) +
      String(tLost).padStart(6) +
      String(tDup).padStart(6) +
      String(tErr).padStart(6),
  );
  lines.push(
    `  RESOURCES       RSS: ${(res.baseline_rss_mb ?? 0).toFixed(0)}MB -> ${(res.peak_rss_mb ?? 0).toFixed(0)}MB (${(res.memory_growth_factor ?? 0).toFixed(2)}x)  Workers: ${res.peak_workers ?? 0}`,
  );
  lines.push('-'.repeat(75));
  lines.push(`  VERDICT: ${v.result}`);
  if (v.warnings.length > 0) for (const w of v.warnings) lines.push(`    WARNING: ${w}`);
  for (const [name, c] of Object.entries(v.checks)) {
    const mk = c.passed ? '+' : '!';
    const adv = c.advisory ? ' (advisory)' : '';
    const label = CHECK_LABELS[name] ?? name + ':';
    lines.push(
      `    ${mk} ${label.padEnd(30)}${c.actual.padEnd(16)}(threshold: ${c.threshold})${adv}`,
    );
  }
  lines.push('='.repeat(75), '');
  console.log(lines.join('\n'));
}

function fmtTs(iso: string): string {
  if (!iso) return 'N/A';
  return iso
    .replace('T', ' ')
    .replace(/\.\d+Z$/, ' UTC')
    .replace('Z', ' UTC');
}

export function writeJsonReport(summary: Record<string, any>, path: string): void {
  // Remove internal _channel_details before writing
  const cleaned = JSON.parse(JSON.stringify(summary));
  if (cleaned.patterns) {
    for (const ps of Object.values(cleaned.patterns) as any[]) {
      delete ps._channel_details;
    }
  }
  writeFileSync(path, JSON.stringify(cleaned, null, 2));
  console.log(`report written to ${path}`);
}
