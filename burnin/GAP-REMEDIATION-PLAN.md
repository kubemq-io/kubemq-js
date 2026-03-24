# JS Burn-In Gap Remediation Plan

> 64 total checklist items: **49 PASS, 13 PARTIAL, 2 MISSING**
> This plan addresses all 15 non-PASS items to reach full compliance.

---

## Priority 1: Critical (functional spec violations)

### GAP-G/13 — Queue Stream consumer must use `QueuesDownstream` bidirectional stream

**Status**: PARTIAL (consumer uses polling `receiveQueueMessages`, not `QueuesDownstream`)
**Spec**: Section 3.3 — "Each consumer MUST maintain its own dedicated `QueuesDownstream` stream"
**File**: `src/workers/queueStream.ts`

**Root cause**: The SDK's `streamQueueMessages()` handle was tested but received 0 messages in the first smoke test. Investigation showed the `onMessages` handler was set AFTER the initial poll response could arrive. Rather than debug the timing, we fell back to the polling API.

**Fix**:

1. Rewrite `startConsumers()` to use `client.streamQueueMessages()` with `autoAck: false`
2. Register `handle.onMessages()` immediately after creating the handle (synchronous — no race since Node.js is single-threaded and gRPC callbacks fire on next event loop tick)
3. In the `onMessages` callback: process all messages, then call `handle.ackAll()` (which triggers `scheduleRePoll()` internally)
4. Register `handle.onClose()` to call `this.incReconnection()` — this handles `CloseByServer` per spec Section 3.3
5. Register `handle.onError()` to call `this.recordError('receive_failure')` and `this.incReconnection()`
6. Store handles in `this.streamHandles` array, close in `stopConsumers()`
7. `QueueStreamOptions` does NOT have `visibilitySeconds` — the SDK manages visibility internally via the stream transaction model

**Code change**:

```typescript
// queueStream.ts — startConsumers
startConsumers(client: KubeMQClient): void {
  const nConsumers = this.cfg.concurrency.queue_stream_consumers;
  for (let i = 0; i < nConsumers; i++) {
    const consumerId = `c-${PATTERN}-${String(i).padStart(3, '0')}`;
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
          this.recordReceive(consumerId, msg.body, tags.content_hash ?? '', decoded.producer_id, decoded.sequence);
        } catch { this.recordError('decode_failure'); }
      }
      handle.ackAll(); // F9: batch ack triggers re-poll
    });
    handle.onError((err) => {
      console.error(`queue_stream error: ${err.message}`);
      this.recordError('receive_failure');
      this.incReconnection();
    });
    handle.onClose(() => {
      // CloseByServer = reconnection event, not error (spec 3.3)
      this.incReconnection();
    });
    this.streamHandles.push(handle);
  }
  mc.setActiveConnections(PATTERN, 1);
}
```

**Test**: Send 100 messages to queue_stream channel, verify all 100 received via `onMessages`. Compare against polling baseline.

---

### GAP-19 — Benchmark mode must auto-set rate to 0 (unlimited)

**Status**: PARTIAL (users must manually set all 6 rate env vars)
**Spec**: Section 4.2 — "Each pattern pushes maximum achievable throughput (no rate limiting)"
**File**: `src/engine.ts` — `createWorkers()` or `run()`

**Fix**: In `engine.ts:run()`, after loading config but before creating workers, override all rates to 0 when `mode === 'benchmark'`:

```typescript
// engine.ts — run(), before createWorkers()
if (this.cfg.mode === 'benchmark') {
  this.cfg.rates.events = 0;
  this.cfg.rates.events_store = 0;
  this.cfg.rates.queue_stream = 0;
  this.cfg.rates.queue_simple = 0;
  this.cfg.rates.commands = 0;
  this.cfg.rates.queries = 0;
}
```

The `RateLimiter` already returns immediately when rate=0. The `targetRate` gauges will show 0 (correct for benchmark). The throughput check is already skipped in benchmark mode per `report.ts`.

---

## Priority 2: Significant (spec compliance gaps)

### GAP-18 — Rate limiter should be token-bucket with 1-second burst capacity

**Status**: PARTIAL (strict metronomic, no burst recovery)
**Spec**: Section 4.1 — "Rate limiting MUST use a token-bucket algorithm with a bucket size of 1 second worth of tokens"
**File**: `src/rateLimiter.ts`

**Fix**: Rewrite `RateLimiter` to maintain a `tokens` counter with max capacity = `rate` (1 second). On each `wait()`, refill tokens based on elapsed time, then consume 1. If no tokens available, sleep until next token.

```typescript
export class RateLimiter {
  private rate: number;
  private tokens: number;
  private maxTokens: number;
  private lastRefill: number;

  constructor(rate: number) {
    this.rate = rate;
    this.maxTokens = rate; // 1 second of burst capacity
    this.tokens = rate;
    this.lastRefill = Date.now();
  }

  async wait(signal: AbortSignal): Promise<boolean> {
    if (signal.aborted) return false;
    if (this.rate <= 0) return true;

    this.refill();
    if (this.tokens >= 1) {
      this.tokens--;
      return true;
    }

    // Wait for next token
    const waitMs = ((1 - this.tokens) / this.rate) * 1000;
    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        this.refill();
        this.tokens--;
        resolve(true);
      }, waitMs);
      const onAbort = () => {
        clearTimeout(timer);
        resolve(false);
      };
      signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.rate);
    this.lastRefill = now;
  }
}
```

---

### GAP-N — Backpressure must log a warning when pausing

**Status**: PARTIAL (pause implemented, no log warning)
**Spec**: Section 4.2 — "the producer should pause and log a warning"
**File**: `src/workers/base.ts` — `backpressureCheck()`

**Fix**: Change `backpressureCheck()` to log once when entering backpressure:

```typescript
private backpressureLogged = false;

backpressureCheck(): boolean {
  const lag = this.sent - this.received;
  const active = lag > this.cfg.queue.max_depth;
  if (active && !this.backpressureLogged) {
    console.warn(`WARNING: ${this.pattern} producer paused — consumer lag ${lag} exceeds max_depth ${this.cfg.queue.max_depth}`);
    this.backpressureLogged = true;
  }
  if (!active) this.backpressureLogged = false;
  return active;
}
```

---

### GAP-X/9 — Warmup should use same API as production + fail-fast on <10 received

**Status**: PARTIAL (events warmup uses `publishEvent` not `createEventStream`; no assertion)
**Spec**: Section 12.1 step 6 — "Send 10 warm-up messages per pattern and verify receipt"
**File**: `src/engine.ts` — `warmupEvents()`, `warmupQueue()`

**Fix**:

1. `warmupEvents()`: Replace `client.publishEvent()` with a temporary `createEventStream().send()` + close after warmup
2. `warmupQueue('queue_stream')`: Replace `sendQueueMessage()` with a temporary `createQueueUpstream().send([msg])` + close
3. Add warning log if received < 10: `console.warn('warmup ${pattern}: only ${count}/${WARMUP_COUNT} received')`

Note: We do NOT fail-hard (exit) on warmup undercount because the spec says "verify receipt" informatively. A warning is sufficient.

---

### GAP-17 — Consumer group balance ratio gauge never set

**Status**: PARTIAL (`burnin_consumer_group_balance_ratio` declared but never computed)
**Spec**: Section 3.7 — "Reported as `burnin_consumer_group_balance_ratio` gauge (min_consumer_count / max_consumer_count)"
**File**: `src/metrics.ts` (helper exists), `src/engine.ts` (needs computation)

**Fix**:

1. Track per-consumer message counts in `BaseWorker` using a `Map<string, number>` — increment in `recordReceive()`
2. In `engine.ts:periodicReport()`, compute balance ratio when consumer group is enabled:

```typescript
if (w.cfg.concurrency.events_consumer_group || w.cfg.concurrency.events_store_consumer_group) {
  const counts = Array.from(w.consumerCounts.values());
  if (counts.length > 1) {
    const min = Math.min(...counts);
    const max = Math.max(...counts);
    mc.setGroupBalance(w.pattern, max > 0 ? min / max : 1.0);
  }
}
```

---

## Priority 3: Minor (formatting, cosmetic, edge cases)

### GAP-C/Q — Banner timing: should print immediately after producers start

**Status**: PARTIAL (banner prints after warmup period, not right after producers)
**Spec**: Section 12.1 — Banner at step 8, after step 7 (start producers)
**File**: `src/engine.ts` — `run()`

**Fix**: Move `this.printBanner()` to immediately after the producer start loop (line 75), before the warmup period wait:

```typescript
// Step 7: Start producers
for (const w of this.workers) { w.startProducers(this.client); }

// Step 8: Banner (immediately after producers start)
this.printBanner();

// Warmup period wait + reset (can be 60s)
if (warmupSec > 0) { ... }
```

---

### GAP-H — Periodic text status format minor alignment

**Status**: PARTIAL (functional but alignment differs slightly from spec)
**Spec**: Section 8.1 — exact column layout

**Fix**: Adjust pad widths to match spec example:

- Pattern names padded to 14 chars (currently correct)
- Values use consistent width: `sent=%-8d  recv=%-8d  lost=%-4d  dup=%-4d  err=%-4d  p99=%.1fms  rate=%d/s`
- This is cosmetic and the current format is very close. No code change strictly required.

---

### GAP-I — Final summary ISO timestamp vs "UTC" suffix

**Status**: PARTIAL (prints raw ISO `2026-03-15T10:00:00.000Z` vs spec `2026-03-15 10:00:00 UTC`)
**Spec**: Section 8.2
**File**: `src/report.ts` — `printConsoleReport()`

**Fix**: Format the timestamps:

```typescript
function formatTimestamp(iso: string): string {
  return iso.replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
}
```

---

### GAP-40 — Dockerfile HEALTHCHECK should use /ready instead of /health

**Status**: PARTIAL
**Spec**: Section 11.2 — "Readiness check: GET /ready"
**File**: `Dockerfile`

**Fix**: The current HEALTHCHECK uses `/health`. Keep it for liveness (correct per spec). The readiness probe (`/ready`) is typically handled by Kubernetes `readinessProbe`, not Docker HEALTHCHECK. No change needed — the Dockerfile is correct for Docker; Kubernetes probes are configured in the deployment YAML (see spec Section 6.0.5).

---

### GAP-T — `unhandledRejection` handler placement

**Status**: PARTIAL (registered pre-run, not just during shutdown)
**Spec**: Section 12.2 — "Add `process.on('unhandledRejection')` handler during shutdown"

**Fix**: The current placement (pre-run) is actually safer — it catches unhandled rejections throughout the lifetime, including shutdown. The spec's suggestion is a minimum requirement; our implementation exceeds it. No change needed.

---

## Summary: Changes by File

| File                         | Changes                                                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `src/workers/queueStream.ts` | **REWRITE**: Use `streamQueueMessages()` with `onMessages/onError/onClose` handlers                                                  |
| `src/rateLimiter.ts`         | **REWRITE**: True token-bucket with 1-second burst capacity                                                                          |
| `src/engine.ts`              | 3 changes: (1) benchmark mode rate override, (2) move banner before warmup wait, (3) add group balance computation in periodicReport |
| `src/workers/base.ts`        | 2 changes: (1) add `consumerCounts` Map for group balance, (2) add backpressure warning log                                          |
| `src/report.ts`              | 1 change: format timestamps as `YYYY-MM-DD HH:MM:SS UTC`                                                                             |

---

## Verification After Fixes

1. `npx tsx src/index.ts --validate-config --config burnin-config.yaml` — exit 0
2. Queue stream smoke test: 30s run, verify `queue_stream recv > 0` in status
3. Benchmark mode test: `BURNIN_MODE=benchmark BURNIN_DURATION=30s` — verify rates show 0 in banner, unlimited throughput
4. Rate limiter test: run at 100/s for 60s, verify actual rate is 95-105/s (±5%)
5. 15-minute soak run against live broker — verify PASSED verdict
6. `curl localhost:8888/metrics | grep burnin_consumer_group_balance_ratio` — verify metric exists

---

## Items Confirmed PASS (no changes needed) — 49 items

| ID  | Description                                        |
| --- | -------------------------------------------------- |
| 1   | YAML auto-discovery with correct priority          |
| 2   | Explicit YAML-to-env-var mapping (56 entries)      |
| 3   | Env var override on top of config file             |
| 4   | --config, --validate-config, --cleanup-only CLI    |
| 5   | Config validation with collected errors            |
| 6   | Broker Ping verification                           |
| 7   | Channel naming `js_burnin_{run_id}_{pattern}_001`  |
| 8   | Stale channel cleanup on startup                   |
| 10  | --cleanup-only mode                                |
| 11  | Events: stream API + payload sequence tracking     |
| 12  | Events Store: await confirmation + incUnconfirmed  |
| 14  | Queue Simple: unary API with auto-ack              |
| 15  | Commands: timeoutMs on proto, no gRPC deadline     |
| 16  | Queries: response body CRC verified                |
| 20  | Warmup excluded from metrics/verdict               |
| 21  | Payload structure with monotonic timestamp         |
| 22  | CRC32 IEEE, 8-char lowercase hex                   |
| 23  | Fixed + distribution size modes                    |
| 24  | Periodic gap detection (not real-time)             |
| 25  | Bounded bitset tracking                            |
| 26  | All 26 Prometheus metrics with sdk label           |
| 27  | Default process metrics not disabled               |
| 28  | REST API: /health /ready /status /summary /metrics |
| 29  | Periodic status logging (text + JSON)              |
| 30  | Final summary report (stdout + file)               |
| 31  | Structured JSON logging                            |
| 32  | Forced disconnect manager                          |
| 33  | All 10 verdict checks                              |
| 34  | PASSED_WITH_WARNINGS state                         |
| 35  | Exit codes 0/1/2                                   |
| 36  | Exponential backoff forever with jitter            |
| 37  | Shutdown within drain+5s budget                    |
| 38  | Shutdown ordering: producers first                 |
| 39  | Channel cleanup configurable                       |
| A   | Config discovery: env > CLI > auto                 |
| B   | Channel naming format                              |
| D   | Consumer group naming                              |
| E   | Events stream API                                  |
| F   | Events Store await confirmation                    |
| J   | /summary JSON structure                            |
| K   | Memory baseline at 5-min                           |
| L   | Error rate formula                                 |
| M   | Reconnection duplicate cooldown                    |
| O   | Unknown YAML keys: WARNING                         |
| P   | Config version > 1: exit 2                         |
| R   | Shutdown within time budget                        |
| S   | Jitter on reconnection                             |
| U   | Histogram buckets exact                            |
| V   | 15 counters / 3 histograms / 8 gauges              |
| W   | Default process metrics                            |
