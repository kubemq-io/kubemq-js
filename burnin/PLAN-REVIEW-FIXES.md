# Plan Review Fixes — Applied Before Implementation

## Critical Fixes from 3-Round Review

### F1. Channel naming includes run_id

- Channels: `js_burnin_{run_id}_{pattern}_001`
- Cleanup prefix: `js_burnin_` (broad, no run_id — Go#8)
- run_id auto-generated as 8-char hex when not set

### F2. EventStreamHandle.send() is SYNC void

- `createEventStream().send(msg)` returns `void` (NOT Promise)
- Do NOT await it — fire-and-forget
- `createEventStoreStream().send(msg)` returns `Promise<void>` — DO await it
- Errors go to `onError` handler, not per-message

### F3. QueueUpstreamHandle.send() takes ARRAY

- `handle.send([msg])` — always pass array, even for single message
- Returns `Promise<QueueUpstreamResult>` with `.isError` boolean
- SDK rejects Promise on isError, so try/catch works

### F4. Subscription callback field names differ

- Events/EventsStore: `onMessage: (event) => void`
- Commands: `onCommand: (cmd) => void`
- Queries: `onQuery: (query) => void`
- All: `onError: (err) => void`

### F5. Config discovery priority (spec Section 6.0.2)

1. `BURNIN_CONFIG_FILE` env var
2. `--config` CLI argument
3. `./burnin-config.yaml`
4. `/etc/burnin/config.yaml`

### F6. Histogram buckets must match spec exactly

- Latency/send: `[0.0005, 0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5]`
- RPC: `[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5]`

### F7. Node.js shutdown: process.on('unhandledRejection')

- Add handler during shutdown to prevent premature exit
- Required by spec Section 12.2

### F8. Events Store subscribe modes

- Initial: `EventStoreType.StartNewOnly`
- Reconnect (SDK handles internally via SubscriptionTracker): `StartAtSequence(lastSeq+1)`
- Burn-in worker subscribes with `StartNewOnly` — SDK handles reconnect

### F9. Queue Stream: ackAll() after full batch

- Use `handle.ackAll()` after processing all messages in batch
- Do NOT call per-message `msg.ack()` — causes multiple re-polls via queueMicrotask
- Process full array from `onMessages` callback, then ackAll

### F10. Config validation completeness

- Unknown YAML keys: log WARNING, continue
- Config version > 1: exit code 2
- Collect ALL errors before reporting
- Contradictory values (auto_ack + visibility): WARNING
- Range checks: rates >= 0, concurrency >= 1, timeouts > 0

### F11. Missing config vars

- `BURNIN_MAX_DURATION` (168h safety valve)
- `BURNIN_WARMUP_DURATION` mode-dependent default (60s benchmark, 0 soak)
- `BURNIN_CLEANUP_CHANNELS` (default true)
- `BURNIN_QUEUE_AUTO_ACK` (default false)

### F12. Reconnection counter in ALL subscription onError callbacks

- Every subscription `onError` must increment `burnin_reconnections_total` for its pattern
- Do NOT attempt re-subscribe in onError — SDK handles it internally

### F13. error_type enum values

- Required strings: `send_failure`, `receive_failure`, `timeout`, `connection_lost`, `decode_failure`, `response_send_failure`, `subscription_error`

### F14. Shutdown sequence order (spec Section 12.2)

1. Stop producers → 2. Drain → 3. Stop consumers → 4. Final metrics
2. Delete channels → 6. Write report file → 7. Print console → 8. Close client → 9. Exit

### F15. Consumer group naming

- Format: `js_burnin_{pattern}_group`
- Fan-out (default): each consumer independent, loss metric uses worst-case (max)
- Consumer group: shared sequence tracker

### F16. Backpressure for benchmark mode

- Pause producers when `sent - received > BURNIN_MAX_QUEUE_DEPTH`

### F17. Throughput check skipped in benchmark mode

- `report.ts` must check `mode !== 'benchmark'` before evaluating throughput

### F18. Downtime check: max across patterns, not sum

### F19. burnin_active_workers gauge: `process._getActiveHandles().length` or similar Node.js metric

### F20. CommandMessage/QueryMessage require `timeoutMs` (mandatory field)
