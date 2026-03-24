# JS/TS SDK Burn-In — REST API Spec Implementation Gap Report

> **Date**: 2026-03-17
> **Spec Version**: 2.2
> **SDK**: JS/TS (kubemq-js)

---

## Summary

| Category                      | Total  |  Done  | In Progress | Remaining | % Complete |
| ----------------------------- | :----: | :----: | :---------: | :-------: | :--------: |
| Boot & Lifecycle (L1-L12)     |   12   |   12   |      0      |     0     |    100%    |
| Endpoints (E1-E11)            |   11   |   11   |      0      |     0     |    100%    |
| HTTP & Error Handling (H1-H8) |   8    |   8    |      0      |     0     |    100%    |
| Config Handling (C1-C13)      |   12   |   12   |      0      |     0     |    100%    |
| Run Data & Metrics (M1-M14)   |   14   |   14   |      0      |     0     |    100%    |
| Report & Verdict (R1-R19)     |   19   |   19   |      0      |     0     |    100%    |
| Startup Config & CLI (S1-S14) |   13   |   13   |      0      |     0     |    100%    |
| **Overall**                   | **89** | **89** |    **0**    |   **0**   |  **100%**  |

---

## 1. Boot & Lifecycle

| #   | Requirement                                                                                | Spec Ref   | JS/TS | Notes                                                        |
| --- | ------------------------------------------------------------------------------------------ | ---------- | :---: | ------------------------------------------------------------ |
| L1  | Boot into `idle` state (no auto-start)                                                     | §2         |  [x]  | `index.ts` starts HTTP server, enters idle                   |
| L2  | HTTP server starts on boot before broker connection                                        | §2         |  [x]  | HTTP server created in `index.ts` before any engine run      |
| L3  | `/health` returns `{"status":"alive"}` with 200 from boot                                  | §3.1       |  [x]  | Always returns 200                                           |
| L4  | `/ready` per-state response: 200 for idle/running/stopped/error, 503 for starting/stopping | §3.1       |  [x]  | State-aware response in httpServer                           |
| L5  | Pre-initialize all Prometheus metrics to 0 on startup                                      | §2, §8.3   |  [x]  | `preInitializeMetrics()` in metrics.ts                       |
| L6  | Run state machine: `idle`→`starting`→`running`→`stopping`→`stopped`/`error`                | §4.1       |  [x]  | `RunState` type in engine.ts                                 |
| L7  | Atomic state transitions (JS: sync mutation in event loop turn)                            | §4.2       |  [x]  | Single-threaded JS, synchronous state changes                |
| L8  | `starting_timeout_seconds` (default 60s) — timer starts at `starting` transition           | §4.1, §4.2 |  [x]  | setTimeout in executeRun()                                   |
| L9  | Per-pattern states: `starting`, `running`, `recovering`, `error`, `stopped`                | §4.3       |  [x]  | `patternStates` record in engine, `recovering` on disconnect |
| L10 | Stop during `starting` — cancel startup, cleanup, generate minimal report, → `stopped`     | §4.4       |  [x]  | Abort signal checked at each async step                      |
| L11 | SIGTERM/SIGINT: stop active run gracefully, generate report, cleanup, exit                 | §9         |  [x]  | Signal handlers in index.ts call engine.requestStop()        |
| L12 | Exit codes: 0=PASSED/PASSED_WITH_WARNINGS, 1=FAILED, 2=config error, 0 if idle             | §9         |  [x]  | process.exit() with verdict-based codes                      |

## 2. Endpoints

| #   | Endpoint                                                                                        | Spec Ref | JS/TS | Notes                                                    |
| --- | ----------------------------------------------------------------------------------------------- | -------- | :---: | -------------------------------------------------------- |
| E1  | `GET /info` — sdk, version, runtime, os, arch, cpus, memory, pid, uptime, state, broker_address | §5.1     |  [x]  | engine.getInfo()                                         |
| E2  | `GET /broker/status` — gRPC Ping() with 3s timeout                                              | §5.2     |  [x]  | engine.pingBroker() with Promise.race 3s timeout         |
| E3  | `POST /run/start` — full config body, validate, return 202 with run_id                          | §5.3     |  [x]  | translateApiConfig + validateRunConfig + fire-and-forget |
| E4  | `POST /run/stop` — graceful stop, return 202. 409 for wrong states                              | §5.4     |  [x]  | State checks, 409 for stopping/idle/stopped/error        |
| E5  | `GET /run` — full state with pattern+worker metrics                                             | §5.5     |  [x]  | engine.buildRunResponse() with per-pattern breakdown     |
| E6  | `GET /run/status` — lightweight state + totals + pattern_states                                 | §5.6     |  [x]  | engine.buildRunStatus() with aggregated totals           |
| E7  | `GET /run/config` — resolved config with channel names. 404 when no run.                        | §5.7     |  [x]  | engine.buildRunConfigResponse()                          |
| E8  | `GET /run/report` — final report with verdict checks map. 404 when none.                        | §5.8     |  [x]  | engine.buildRunReport() returns stored report            |
| E9  | `POST /cleanup` — delete all `js_burnin_*` channels. 409 during active run.                     | §5.9     |  [x]  | engine.cleanupChannels()                                 |
| E10 | Legacy alias: `/status` → `/run/status` with deprecation warning                                | §3       |  [x]  | Logged once per boot                                     |
| E11 | Legacy alias: `/summary` → `/run/report` with deprecation warning                               | §3       |  [x]  | Logged once per boot                                     |

## 3. HTTP & Error Handling

| #   | Requirement                                                           | Spec Ref         | JS/TS | Notes                                       |
| --- | --------------------------------------------------------------------- | ---------------- | :---: | ------------------------------------------- |
| H1  | CORS headers on all responses with configurable `BURNIN_CORS_ORIGINS` | §7               |  [x]  | setCors() on every response                 |
| H2  | `OPTIONS` preflight → 204 No Content with CORS headers                | §7               |  [x]  | Handled first in request handler            |
| H3  | Error response format: `{"message": "...", "errors": [...]}`          | §6               |  [x]  | Consistent across all error paths           |
| H4  | `400` for invalid JSON body with parse error in message               | §5.3.4, §6       |  [x]  | JSON.parse try/catch                        |
| H5  | `400` for validation errors — collect ALL errors, return together     | §5.3.4           |  [x]  | validateRunConfig collects all errors       |
| H6  | `409` for state conflicts — include current `run_id` and `state`      | §5.3, §5.4, §5.9 |  [x]  | All 409 responses include state info        |
| H7  | `Content-Type: application/json` header on all JSON responses         | §3               |  [x]  | Set in jsonResponse()                       |
| H8  | Silently ignore unknown JSON fields in POST body                      | §1, §5.3.4       |  [x]  | JSON.parse naturally ignores unknown fields |

## 4. Config Handling

| #   | Requirement                                                                 | Spec Ref     | JS/TS | Notes                                               |
| --- | --------------------------------------------------------------------------- | ------------ | :---: | --------------------------------------------------- |
| C1  | Parse nested per-pattern API config schema                                  | §5.3.1       |  [x]  | ApiRunConfig interface + translateApiConfig()       |
| C2  | Translate API nested config → internal flat config                          | §5.3.3       |  [x]  | translateApiConfig() follows normative mapping      |
| C3  | Per-pattern `enabled` flag — skip disabled patterns                         | §5.3.2, §5.5 |  [x]  | enabled_patterns checked in engine + responses      |
| C4  | Per-pattern threshold overrides: loss_pct, p99, p999                        | §5.3.3       |  [x]  | pattern_thresholds + getPatternLossThreshold() etc. |
| C5  | Default rate values when omitted                                            | §5.3.2       |  [x]  | Defaults in DEFAULTS constant                       |
| C6  | Default loss thresholds: events=5.0%, others=0.0%                           | §5.3.2       |  [x]  | getPatternLossThreshold() uses correct defaults     |
| C7  | `warmup_duration` mode-dependent default                                    | §5.3.2       |  [x]  | Set in translateApiConfig()                         |
| C8  | `run_id` auto-generation (8-char hex) when empty                            | §5.3.2       |  [x]  | randomBytes(4).toString('hex')                      |
| C9  | Full validation: mode, duration, rate>0, etc.                               | §5.3.4       |  [x]  | validateRunConfig()                                 |
| C10 | `visibility_seconds` omitted from API — silently ignore in YAML             | §5.3.2, §2.1 |  [x]  | Not in ApiRunConfig; YAML deepMerge ignores unknown |
| C12 | `poll_wait_timeout_seconds` → ms for Queue Stream, seconds for Queue Simple | §5.3.2       |  [x]  | Existing worker logic handles conversion            |
| C13 | `max_duration` safety cap (default 168h)                                    | §5.3.2       |  [x]  | maxDurationSec() used for duration=0 runs           |

## 5. Run Data & Metrics (REST API)

| #   | Requirement                                                                          | Spec Ref | JS/TS | Notes                                                                           |
| --- | ------------------------------------------------------------------------------------ | -------- | :---: | ------------------------------------------------------------------------------- |
| M1  | Per-run REST counters (reset on new run)                                             | §8.2     |  [x]  | Workers recreated per run; Prometheus counters monotonic                        |
| M2  | Pattern-level aggregates in responses                                                | §5.5     |  [x]  | buildPatternsResponse() computes all fields                                     |
| M3  | Per-producer metrics: id, sent, errors, actual_rate, latency                         | §5.5     |  [x]  | Per-worker arrays in buildPatternsResponse() with SlidingRateTracker            |
| M4  | Per-consumer metrics: id, received, lost, duplicated, corrupted, errors, latency     | §5.5     |  [x]  | Per-worker consumer arrays with full breakdown                                  |
| M5  | Per-sender RPC metrics                                                               | §5.5     |  [x]  | Per-sender arrays with sliding rate + latency                                   |
| M6  | Per-responder RPC metrics                                                            | §5.5     |  [x]  | Per-responder arrays with responded + errors                                    |
| M7  | `actual_rate` = 30-second sliding average                                            | §5.5.1   |  [x]  | SlidingRateTracker (30s window) in peakRate.ts, used by buildPatternsResponse() |
| M8  | `peak_rate` = highest 10-second window                                               | §5.5.1   |  [x]  | PeakRateTracker                                                                 |
| M9  | `bytes_sent` / `bytes_received` per pattern                                          | §5.5.1   |  [x]  | Prometheus counters track bytes; REST response included                         |
| M10 | `unconfirmed` count for Events Store only                                            | §5.5.1   |  [x]  | Included in events_store pattern response                                       |
| M11 | Live resource metrics: rss_mb, baseline_rss_mb, memory_growth_factor, active_workers | §5.5     |  [x]  | buildResourcesLive()                                                            |
| M12 | Totals aggregation: RPC success→received, timeout+error→lost                         | §5.6     |  [x]  | buildRunStatus() totals logic                                                   |
| M13 | `out_of_order` included in totals                                                    | §5.6     |  [x]  | Added to totals aggregation                                                     |
| M14 | `resources` naming: live=rss_mb/active_workers, report=peak_rss_mb/peak_workers      | §5.5     |  [x]  | Different methods for live vs report                                            |

## 6. Report & Verdict

| #   | Requirement                                                                       | Spec Ref     | JS/TS | Notes                                                                                                                                       |
| --- | --------------------------------------------------------------------------------- | ------------ | :---: | ------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Report available via `GET /run/report` after stopped/error. 404 otherwise.        | §5.8         |  [x]  | Stored in engine.\_report                                                                                                                   |
| R2  | Error-from-startup report: verdict=FAILED, `startup` check                        | §5.8.3       |  [x]  | generateStartupErrorVerdict()                                                                                                               |
| R3  | `all_patterns_enabled` boolean flag in report                                     | §5.8.2       |  [x]  | Computed from enabled_patterns                                                                                                              |
| R4  | `warnings` array: "Not all patterns enabled" when applicable                      | §5.8.1       |  [x]  | Added in generateVerdict()                                                                                                                  |
| R5  | `peak_rate` per pattern in report                                                 | §5.8.2       |  [x]  | From PeakRateTracker                                                                                                                        |
| R6  | `avg_rate` per pattern in report                                                  | §5.8.2       |  [x]  | Computed as total_sent/elapsed                                                                                                              |
| R7  | Worker-level breakdown in report                                                  | §5.8.2       |  [x]  | Per-worker arrays (producers/consumers/senders/responders) with avg_rate in buildSummary()                                                  |
| R8  | Verdict checks as map: keys `"name:pattern"` for per-pattern, `"name"` for global | §5.8.1       |  [x]  | New generateVerdict() format                                                                                                                |
| R9  | Check result fields: `passed`, `threshold`, `actual`, `advisory` (default false)  | §5.8.1       |  [x]  | CheckResult interface                                                                                                                       |
| R10 | Normative check names                                                             | §5.8.1       |  [x]  | message_loss, duplication, corruption, p99_latency, p999_latency, throughput, error_rate, memory_stability, memory_trend, downtime, startup |
| R11 | `duplication` checks: per pub/sub+queue only (not RPC)                            | §5.8.1       |  [x]  | PUBSUB_QUEUE filter                                                                                                                         |
| R12 | `error_rate` checks: per enabled pattern                                          | §5.8.1       |  [x]  | Formula: errors/(sent+received)\*100                                                                                                        |
| R13 | `throughput` check: global min, avg_rate vs target. Soak only.                    | §5.8.1       |  [x]  | Min across patterns                                                                                                                         |
| R14 | `memory_trend` advisory: formula `1.0 + (max_factor-1.0)*0.5`                     | §5.8.1       |  [x]  | Correct formula implemented                                                                                                                 |
| R15 | `PASSED_WITH_WARNINGS` logic                                                      | §5.8.1       |  [x]  | anyNonAdvisoryFail / anyAdvisoryFail tracking                                                                                               |
| R16 | Memory baseline: 5min/1min/running-start rules                                    | §5.8.1       |  [x]  | 5min default, 1min for runs <5min, running-start for runs <1min. memory_stability marked advisory for <5min runs.                           |
| R17 | Per-pattern loss checks using pattern-specific thresholds                         | §5.8, §5.3.3 |  [x]  | getPatternLossThreshold()                                                                                                                   |
| R18 | Per-pattern latency checks (p99, p999)                                            | §5.8, §5.3.3 |  [x]  | getPatternP99Threshold(), getPatternP999Threshold()                                                                                         |
| R19 | Verdict result: PASSED / PASSED_WITH_WARNINGS / FAILED                            | §5.8.1       |  [x]  | Three-state logic                                                                                                                           |

## 7. Startup Config & CLI

| #   | Requirement                                               | Spec Ref | JS/TS | Notes                                    |
| --- | --------------------------------------------------------- | -------- | :---: | ---------------------------------------- |
| S1  | `BURNIN_METRICS_PORT` / `metrics.port` (default 8888)     | §2.1     |  [x]  | Existing                                 |
| S2  | `BURNIN_LOG_FORMAT` / `logging.format`                    | §2.1     |  [x]  | Existing                                 |
| S3  | `BURNIN_LOG_LEVEL` / `logging.level`                      | §2.1     |  [x]  | Existing                                 |
| S4  | `BURNIN_CORS_ORIGINS` / `cors.origins` (default `*`)      | §2.1, §7 |  [x]  | New: `cors_origins` in Config            |
| S5  | `BURNIN_BROKER_ADDRESS` / `broker.address` (startup-only) | §2.1     |  [x]  | Existing; used by engine for all runs    |
| S6  | `BURNIN_CLIENT_ID_PREFIX` / `broker.client_id_prefix`     | §2.1     |  [x]  | Existing                                 |
| S7  | `BURNIN_RECONNECT_INTERVAL` (with 0-25% jitter)           | §2.1     |  [x]  | Existing; jitter via KubeMQClient config |
| S8  | `BURNIN_RECONNECT_MAX_INTERVAL`                           | §2.1     |  [x]  | Existing                                 |
| S9  | `BURNIN_RECONNECT_MULTIPLIER`                             | §2.1     |  [x]  | Existing                                 |
| S10 | `BURNIN_REPORT_OUTPUT_FILE` (SIGTERM flow only)           | §2.1     |  [x]  | Existing                                 |
| S11 | `BURNIN_SDK_VERSION` (auto-detect fallback)               | §2.1     |  [x]  | Existing                                 |
| S13 | `--cleanup-only` CLI mode                                 | §2.2     |  [x]  | Existing                                 |
| S14 | `--validate-config` CLI mode                              | §2.2     |  [x]  | Existing                                 |

---

## Previously Open Gaps — Now Resolved

### M3/M4/M5/M6/R7: Per-Worker Metric Breakdown

**Status:** ✅ Fixed — Per-worker arrays (producers, consumers, senders, responders) now included in both `GET /run` (live) and `GET /run/report` (final) responses. Each worker entry has an id, all relevant counters, and rate/latency data. Live responses use `actual_rate` (sliding), report uses `avg_rate` (lifetime).

### R16: Memory Baseline Advisory for Short Runs

**Status:** ✅ Fixed — Memory baseline timing now follows spec rules:

- Runs ≥5min: baseline at 5-min mark (standard)
- Runs 1–5min: baseline at 1-min mark
- Runs <1min: baseline at running-start
- `memory_stability` check is marked advisory for runs shorter than 5 minutes

### M7: actual_rate 30-Second Sliding Average

**Status:** ✅ Fixed — `SlidingRateTracker` class added to `peakRate.ts` with 30-second window. Integrated into `BaseWorker.slidingRate` and used by `buildPatternsResponse()` for live `actual_rate`. Falls back to lifetime average when sliding window has no data yet.

---

## Files Modified

| File                  | Change Type | Description                                                                                                                                                                                                      |
| --------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/config.ts`       | Modified    | Added `starting_timeout_seconds`, `cors_origins`, `enabled_patterns`, `pattern_thresholds` fields. Added `ApiRunConfig` interface, `translateApiConfig()`, `validateRunConfig()`, per-pattern threshold getters. |
| `src/engine.ts`       | Rewritten   | State machine lifecycle, per-pattern states, per-worker arrays in both live and report responses, SlidingRateTracker for actual_rate, memory baseline with 5min/1min/running-start rules and advisory flag.      |
| `src/httpServer.ts`   | Rewritten   | All spec endpoints with CORS, legacy aliases, POST body parsing.                                                                                                                                                 |
| `src/index.ts`        | Rewritten   | Boot sequence, CLI modes, SIGTERM/SIGINT handling.                                                                                                                                                               |
| `src/report.ts`       | Modified    | Per-pattern verdict checks, `memoryBaselineAdvisory` parameter for short runs, advisory memory_stability for <5min runs.                                                                                         |
| `src/metrics.ts`      | Modified    | `preInitializeMetrics()` function.                                                                                                                                                                               |
| `src/peakRate.ts`     | Modified    | Added `SlidingRateTracker` class (30-second sliding window for actual_rate).                                                                                                                                     |
| `src/workers/base.ts` | Modified    | Added `slidingRate` tracker, integrated into `recordSend()` and `resetAfterWarmup()`.                                                                                                                            |

## Unchanged Files

| File                         | Reason                 |
| ---------------------------- | ---------------------- |
| `src/workers/events.ts`      | Worker logic preserved |
| `src/workers/eventsStore.ts` | Worker logic preserved |
| `src/workers/queueStream.ts` | Worker logic preserved |
| `src/workers/queueSimple.ts` | Worker logic preserved |
| `src/workers/commands.ts`    | Worker logic preserved |
| `src/workers/queries.ts`     | Worker logic preserved |
| `src/workers/index.ts`       | No changes needed      |
| `src/payload.ts`             | No changes needed      |
| `src/rateLimiter.ts`         | No changes needed      |
| `src/tracker.ts`             | No changes needed      |
| `src/timestampStore.ts`      | No changes needed      |
| `src/disconnect.ts`          | No changes needed      |
| `package.json`               | No new dependencies    |
| `tsconfig.json`              | No changes needed      |
