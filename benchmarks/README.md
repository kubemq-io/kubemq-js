# KubeMQ JS SDK — Benchmarks

Performance benchmarks for the KubeMQ JS SDK v3.

## Prerequisites

- Node.js 20+
- Docker (for integration benchmarks only)

## Quick Start

### Unit benchmarks (no server required)

```bash
npm run bench
```

Runs serialization, error creation, retry backoff, message buffer, and ID generation benchmarks.

### Integration benchmarks (requires KubeMQ server)

```bash
npm run bench:setup       # Start KubeMQ in Docker
npm run bench             # Run all benchmarks
npm run bench:teardown    # Stop KubeMQ
```

## Benchmark Files

| File                      | Category                                   | Server Required |
| ------------------------- | ------------------------------------------ | --------------- |
| `serialization.bench.ts`  | `stringToBytes`/`bytesToString` throughput | No              |
| `error-creation.bench.ts` | Error class instantiation overhead         | No              |
| `retry-backoff.bench.ts`  | Backoff computation performance            | No              |
| `message-buffer.bench.ts` | Buffer conversion throughput               | No              |
| `id-generation.bench.ts`  | UUID generation via `crypto.randomUUID()`  | No              |
| `roundtrip.bench.ts`      | End-to-end ping roundtrip                  | Yes             |

## Methodology

- **Framework:** Vitest bench (uses `tinybench` internally)
- **Server:** KubeMQ Community Edition in Docker (single node, default config)
- **Client:** Same machine (localhost), single `KubeMQClient` instance
- **Warmup:** Configurable per benchmark (typically 50–100 iterations discarded)
- **Measurement:** Configurable iterations, reported as ops/sec
- **Latency:** `performance.now()` (sub-millisecond precision)
- **Statistics:** Vitest bench reports min, max, mean, p75, p99, p999
- **Environment:** Ensure no other CPU-intensive processes during benchmarking

## Hardware Requirements

- Recommended: 4+ CPU cores, 8+ GB RAM
- Benchmarks should be run on a quiet machine for reproducible results
- Results vary by hardware — use relative comparisons, not absolute numbers

## Results Output

Benchmark results are written to `benchmarks/results/latest.json` in JSON format.
This file can be consumed by CI for regression detection.

## Baseline Results

Baseline numbers are hardware-dependent. Run `npm run bench` on your target
hardware to establish your baseline. Expected order-of-magnitude performance:

| Benchmark                          | Expected Range  |
| ---------------------------------- | --------------- |
| `stringToBytes` — short string     | 5–20M ops/sec   |
| `bytesToString` — short bytes      | 5–20M ops/sec   |
| `toBytes` — Uint8Array passthrough | 100M+ ops/sec   |
| `generateId()`                     | 2–10M ops/sec   |
| Error instantiation                | 1–5M ops/sec    |
| Backoff computation                | 50–200M ops/sec |
| `normalizeBody` — Uint8Array       | 100M+ ops/sec   |
| Ping roundtrip (localhost)         | 5–20K ops/sec   |

## Connection Reuse Verification

```bash
npx tsx benchmarks/verify-connection-reuse.ts
```

Confirms that a single `KubeMQClient` uses one gRPC channel for all operations.
