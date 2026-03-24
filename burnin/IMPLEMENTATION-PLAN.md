# JavaScript/TypeScript Burn-In Test App — Implementation Plan

## Context

Third SDK burn-in implementation after Go and Python. The JS SDK at `kubemq-js/src/` uses a **single unified `KubeMQClient`** (async factory `KubeMQClient.create()`). Subscriptions are **callback-based and non-blocking** — they return a `Subscription` handle with `.cancel()`. The SDK has full streaming support: `createEventStream()`, `createEventStoreStream()`, `createQueueUpstream()`, `streamQueueMessages()`. All 36 lessons from Go + Python retrospectives are pre-applied.

---

## Key JS SDK Differences from Go and Python

1. **Single unified client** — one `KubeMQClient` for all patterns (not 3 separate clients like Python, not 1 like Go but different API surface)
2. **Async factory pattern** — `await KubeMQClient.create(options)`, not `new Client()`
3. **Callback-based non-blocking subscriptions** — returns `Subscription` handle, not blocking thread (similar to Python's behavior, Lesson Py#2)
4. **Native stream APIs available** — `createEventStream()`, `createEventStoreStream()`, `createQueueUpstream()`, `streamQueueMessages()` (unlike Python which lacks stream queue API)
5. **Single-threaded event loop** — No threads/goroutines. Use `setInterval`/`setTimeout` for periodic tasks. Rate limiting via async delays.
6. **`publishEvent()` / `publishEventStore()`** — both return `Promise<void>`, throw on error. Events Store confirmation is via the stream handle's `send()` which returns `Promise<void>` (awaiting gRPC confirmation)
7. **`sendQueueMessage()` returns `QueueSendResult`** — check for throw (no `.is_error` field)
8. **RPC responses** — `CommandResponse.executed` boolean + `CommandResponse.error` string. `QueryResponse.executed` + `QueryResponse.body`
9. **`ClientOptions`** has `retry: RetryPolicy` and `reconnect: ReconnectionPolicy` with jitter support — fully configurable from burn-in
10. **`Subscription.cancel()`** for clean subscription teardown. `AbortController`/`AbortSignal` supported.

---

## File Structure

```
kubemq-js/burnin/
  package.json                # npm: kubemq-js local path, yaml, prom-client, hdr-histogram-js
  tsconfig.json               # TypeScript config
  Dockerfile                  # Multi-arch, non-root user

  src/
    index.ts                  # Entry point: CLI, signal handling, exit codes
    config.ts                 # Config interface, YAML load, env override table, validation
    engine.ts                 # Orchestrator: 1 SDK client, warmup all 6 patterns, periodic tasks, 2-phase shutdown
    payload.ts                # JSON encode/decode, CRC32 (lookup-table), crypto.randomBytes padding
    tracker.ts                # Bitset sequence tracker (sliding window, delta-based detect_gaps)
    rateLimiter.ts            # Token-bucket rate limiter for async loops
    timestampStore.ts         # (producer_id, seq) → hrtime mapping
    peakRate.ts               # PeakRateTracker (10s window) + LatencyAccumulator (HdrHistogram)
    metrics.ts                # All 26 Prometheus metrics + helper functions (prom-client)
    httpServer.ts             # Node http server: /health /ready /status /summary /metrics
    report.ts                 # 10 checks + memory_trend advisory, PASSED/PASSED_WITH_WARNINGS/FAILED, console + JSON
    disconnect.ts             # Forced disconnect: close client, wait, recreate

    workers/
      base.ts                 # BaseWorker: AbortController for 2-phase shutdown, dual tracking, all counters
      events.ts               # Events: createEventStream() + subscribeToEvents()
      eventsStore.ts          # Events Store: createEventStoreStream() + subscribeToEventsStore() + StartAtSequence
      queueStream.ts          # Queue Stream: createQueueUpstream() + streamQueueMessages() with manual ack
      queueSimple.ts          # Queue Simple: sendQueueMessage() + receiveQueueMessages() with auto-ack
      commands.ts             # Commands: sendCommand() + subscribeToCommands() + sendCommandResponse()
      queries.ts              # Queries: sendQuery() + subscribeToQueries() + sendQueryResponse()
      index.ts                # Worker exports

  burnin-config.yaml          # Example config (same YAML schema as Go/Python)
  IMPLEMENTATION-RETROSPECTIVE.md  # JS-specific learnings
```

~20 TypeScript source files.

---

## Concurrency Architecture (Node.js Single-Threaded)

```
Event Loop
  ├── Engine.run() — main async orchestrator
  │   ├── Per-pattern: Consumer callback (subscription onMessage)
  │   ├── Per-pattern: Producer async loop (setImmediate/await between sends)
  │   ├── setInterval: periodicReporter (every BURNIN_REPORT_INTERVAL)
  │   ├── setInterval: peakRateAdvancer (every 1s)
  │   ├── setInterval: uptimeTracker (every 1s)
  │   ├── setInterval: memoryTracker (every 10s)
  │   ├── setInterval: timestampPurger (every 60s)
  │   ├── HTTP Server (Node http module, non-blocking)
  │   └── [Optional] setTimeout: disconnectManager
  └── Signal handlers: SIGTERM/SIGINT → AbortController.abort()
```

No threads. All producers use `async function` with `await rateLimiter.wait()` yielding to event loop. Subscriptions deliver callbacks on the event loop. 2-phase shutdown via two `AbortController` instances:

```
producerAbort.abort() ──→ stops all producer loops
       ↓ drain timeout
consumerAbort.abort() ──→ cancels all Subscription handles
```

---

## Go + Python Retrospective Lessons Pre-Applied

| #     | Source | Lesson                         | JS Implementation                                                                                         |
| ----- | ------ | ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Go#1  | Go     | Prometheus counter deltas      | `tracker.detectGaps()` returns delta via `lastReportedLost`                                               |
| Go#2  | Go     | 2-phase shutdown in base class | `BaseWorker` constructor creates `producerAbort` + `consumerAbort` AbortControllers                       |
| Go#3  | Go     | Memory baseline at 5-min       | Seed on first sample, update at 300s, shutdown fallback                                                   |
| Go#5  | Go     | Every /summary field populated | Dual tracking (Prometheus + in-process counters) for all fields                                           |
| Go#6  | Go     | Warmup ALL 6 patterns          | events→createEventStream, es→createEventStoreStream, queue→send+receive, rpc→sub+send                     |
| Go#7  | Go     | Sent counter after success     | Events: no throw. EventsStore: stream.send() resolves. Queue: no throw. RPC: no throw + response.executed |
| Go#8  | Go     | Cleanup broad prefix           | `js_burnin_` (no run_id)                                                                                  |
| Go#9  | Go     | Error rate formula             | `errors / (sent + received) * 100`                                                                        |
| Go#10 | Go     | RPC status format              | `resp=/tout=` for commands/queries                                                                        |
| Go#12 | Go     | PASSED_WITH_WARNINGS           | Three-state verdict with `memory_trend` advisory                                                          |
| Go#14 | Go     | Peak rate wired                | `record()` on send, `advance()` every 1s, `peak()` in summary                                             |
| Go#16 | Go     | Warmup correct API per pattern | Use stream API for events/es warmup                                                                       |
| Go#17 | Go     | Warmup includes content_hash   | All warmup messages have `tags["content_hash"]`                                                           |
| Go#18 | Go     | Responders check warmup tag    | Check `tags["warmup"] === "true"` FIRST in all responder callbacks                                        |
| Go#19 | Go     | Queue batch drain              | Drain entire batch before next Get                                                                        |
| Py#2  | Python | Non-blocking subscriptions     | subscribe returns handle; wait on abort signal, don't loop/resubscribe                                    |
| Py#5  | Python | Error field checking           | Check `response.error` (truthy string) or `!response.executed`                                            |
| Py#8  | Python | Project layout                 | Use standard npm layout, don't fight the build tool                                                       |
| Py#12 | Python | Config type resolution         | TypeScript has concrete types at runtime — no annotation issues                                           |

---

## Implementation Order

### Phase 1: Foundation

1. `package.json` — dependencies + local SDK path
2. `tsconfig.json` — TypeScript configuration
3. `src/config.ts` — full config with all env vars
4. `src/payload.ts` — encode/decode, CRC32, padding
5. `src/tracker.ts` — bitset tracker with sliding window and delta gaps
6. `src/rateLimiter.ts` — async token-bucket for event loop
7. `src/timestampStore.ts` — send time store
8. `src/peakRate.ts` — PeakRateTracker + LatencyAccumulator
9. `src/metrics.ts` — all 26 metrics + helpers

### Phase 2: Infrastructure

10. `src/httpServer.ts` — 5 endpoints
11. `src/workers/base.ts` — BaseWorker with full interface
12. `src/index.ts` — CLI entry point

### Phase 3: Workers (all 6)

13. `src/workers/events.ts` — uses `createEventStream()` for sending
14. `src/workers/eventsStore.ts` — uses `createEventStoreStream()` with confirmation
15. `src/workers/queueStream.ts` — uses `createQueueUpstream()` + `streamQueueMessages()`
16. `src/workers/queueSimple.ts` — uses `sendQueueMessage()` + `receiveQueueMessages()`
17. `src/workers/commands.ts`
18. `src/workers/queries.ts`
19. `src/workers/index.ts`

### Phase 4: Engine + Report + Disconnect

20. `src/engine.ts` — full orchestrator with warmup + periodic tasks
21. `src/report.ts` — 10 checks + advisory + console/JSON
22. `src/disconnect.ts` — forced disconnect manager

### Phase 5: Polish

23. `burnin-config.yaml`
24. `Dockerfile`
25. `IMPLEMENTATION-RETROSPECTIVE.md` (template)

---

## SDK API Mapping (JS ↔ Go ↔ Spec)

| Spec Pattern                       | Go API                                                        | JS API                                                                     |
| ---------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Events send (stream)               | `SendEventStream()` → `handle.Send()`                         | `createEventStream()` → `handle.send()`                                    |
| Events subscribe                   | `SubscribeToEvents()` (blocking)                              | `subscribeToEvents()` → `Subscription` (non-blocking callback)             |
| Events Store send (stream+confirm) | `SendEventStoreStream()` → `handle.Send()` + `handle.Results` | `createEventStoreStream()` → `handle.send()` (Promise resolves on confirm) |
| Events Store subscribe             | `SubscribeToEventsStore()` (blocking)                         | `subscribeToEventsStore()` → `Subscription` (non-blocking callback)        |
| Queue Stream send                  | `QueueUpstream()` → `handle.Send()`                           | `createQueueUpstream()` → `handle.send()`                                  |
| Queue Stream receive               | `QueueDownstream()` → `handle.Messages`                       | `streamQueueMessages()` → `handle.onMessages()` callback                   |
| Queue Simple send                  | `SendQueueMessage()` (unary)                                  | `sendQueueMessage()` (unary)                                               |
| Queue Simple receive               | `ReceiveQueueMessages()` (unary poll)                         | `receiveQueueMessages()` (unary poll)                                      |
| Commands send                      | `SendCommand()`                                               | `sendCommand()` → `Promise<CommandResponse>`                               |
| Commands subscribe                 | `SubscribeToCommands()` (blocking)                            | `subscribeToCommands()` → `Subscription` (non-blocking callback)           |
| Commands respond                   | `SendResponse()`                                              | `sendCommandResponse()`                                                    |
| Queries send                       | `SendQuery()`                                                 | `sendQuery()` → `Promise<QueryResponse>`                                   |
| Queries subscribe                  | `SubscribeToQueries()` (blocking)                             | `subscribeToQueries()` → `Subscription` (non-blocking callback)            |
| Queries respond                    | `SendResponse()`                                              | `sendQueryResponse()`                                                      |
| Ping                               | `Ping()`                                                      | `ping()` → `Promise<ServerInfo>`                                           |
| Channel create                     | `CreateChannel()`                                             | `createEventsChannel()` etc.                                               |
| Channel delete                     | `DeleteChannel()`                                             | `deleteEventsChannel()` etc.                                               |
| Channel list                       | `ListChannels()`                                              | `listEventsChannels()` etc.                                                |

---

## Node.js-Specific Design Decisions

### Rate Limiting

```typescript
class RateLimiter {
  async wait(signal: AbortSignal): Promise<boolean>;
}
```

Uses `setTimeout` wrapped in a Promise that resolves at the next token time. `AbortSignal` integration for clean cancellation.

### Periodic Tasks

```typescript
const interval = setInterval(() => { ... }, intervalMs);
// On shutdown:
clearInterval(interval);
```

All intervals stored in engine for cleanup.

### Memory Tracking

```typescript
process.memoryUsage().rss; // Returns bytes, convert to MB
```

### CRC32

Use a bundled lookup-table CRC32 implementation (~40 lines) to avoid external dependency. The `crc` npm package is an alternative but adds a dependency.

### HdrHistogram

Use `hdr-histogram-js` npm package (pure JS, well-maintained).

### Prometheus Metrics

Use `prom-client` npm package (de facto standard for Node.js).

### HTTP Server

Use Node.js built-in `http.createServer()` — no Express needed.

---

## Startup Sequence (Section 12.1)

1. Parse CLI args, load YAML config, apply env overrides, validate — exit 2 on error
2. Create `KubeMQClient` via `KubeMQClient.create(options)` with reconnect policy
3. `await client.ping()` — verify broker connectivity
4. Clean stale channels (broad `js_burnin_` prefix)
5. Create all channels (idempotent via `createEventsChannel()` etc.)
6. Start HTTP server → `/health` returns 200
7. Create workers, start consumers only (subscriptions + queue stream handles)
8. Run warmup: 10 messages per pattern, verify receipt
9. `/ready` returns 200
10. Start producers (after consumers confirmed + warmup verified)
11. If warmup_duration > 0: wait, then reset counters
12. Print startup banner
13. Start periodic tasks (setInterval)
14. Start disconnect manager (if configured)
15. Wait for duration or SIGTERM/SIGINT

---

## Shutdown Sequence (Section 12.2)

1. Clear all periodic intervals
2. Stop all producers (`producerAbort.abort()`)
3. Wait `drain_timeout_seconds`
4. Stop all consumers (`consumerAbort.abort()` → calls `subscription.cancel()`)
5. Enforce hard deadline: `drain_timeout_seconds + 5s`
6. Snapshot final metrics
7. Write JSON report to file (if configured)
8. Print console report
9. Clean channels (best-effort)
10. `await client.close()`
11. Stop HTTP server
12. `process.exit(exitCode)` — 0=PASSED, 1=FAILED, 2=config error

---

## Verification Steps

1. `npx tsx src/index.ts --validate-config --config burnin-config.yaml` — exit 0
2. `npx tsx src/index.ts --cleanup-only --config burnin-config.yaml` — broad prefix in logs
3. Grep every metric helper → at least 1 call site
4. Grep every /summary field → populated in `buildSummary()`
5. 15-minute run against live broker on localhost:50000
6. `curl localhost:8888/summary | jq .` — all fields non-zero
7. `curl localhost:8888/metrics | grep burnin_` — all 26 metrics present
8. SIGTERM → clean 2-phase shutdown in logs
9. Exit code 0 for PASSED

---

## Retrospective Checkpoint

During implementation, maintain `kubemq-js/burnin/IMPLEMENTATION-RETROSPECTIVE.md` with:

1. **JS-specific issues** (event loop pitfalls, single-thread effects, async/await gotchas)
2. **Spec ambiguities** found during implementation
3. **SDK bugs or limitations** encountered
4. **New lessons** not covered by Go/Python retrospectives
5. **Verification failures** from live broker testing

Format each entry as:

```
### N. Short Title (Severity: Critical/High/Medium/Low)
**What happened**: ...
**Root cause**: ...
**Fix**: ...
**Rule for other SDKs**: ...
```
