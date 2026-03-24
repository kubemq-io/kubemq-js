# Performance Guide

Performance characteristics, tuning guidance, and optimization tips for the KubeMQ JS SDK v3.

## Overview

The KubeMQ JS SDK v3 is designed for minimal overhead and efficient resource usage:

- **Single gRPC channel** — all operations multiplex over one HTTP/2 connection
- **Cached encoders** — `TextEncoder`/`TextDecoder` singletons avoid per-call allocation
- **Zero-copy** — `Uint8Array` passthrough and `Buffer` views avoid unnecessary data copies
- **Lazy initialization** — messaging pattern handlers created on first use
- **Async TLS loading** — certificates load concurrently without blocking the event loop
- **No unnecessary dependencies** — runtime footprint limited to `@grpc/grpc-js` and `google-protobuf`

## Benchmark Suite

Run benchmarks locally:

```bash
# Unit benchmarks (no server required)
npm run bench

# With KubeMQ server (Docker)
npm run bench:setup
npm run bench
npm run bench:teardown
```

See `benchmarks/README.md` for detailed methodology and baseline results.

## Connection Reuse

KubeMQ JS SDK uses a single gRPC channel (HTTP/2 connection) for all operations.
Multiple concurrent operations multiplex over the same channel automatically.

**DO:**

```typescript
const client = await KubeMQClient.create({ address: 'localhost:50000' });
// Use this single client for all operations across your application
await client.sendEvent(eventMsg);
await client.sendCommand(commandMsg);
await client.sendQueueMessage(queueMsg);
```

**DON'T:**

```typescript
// WRONG: Do not create multiple clients for the same server
const client1 = await KubeMQClient.create({ address: 'localhost:50000' });
const client2 = await KubeMQClient.create({ address: 'localhost:50000' });
// This wastes resources — each client creates its own TCP connection
```

**DON'T:**

```typescript
// WRONG: Do not create a client per operation
async function handleRequest(data: Uint8Array) {
  const client = await KubeMQClient.create({ address: 'localhost:50000' });
  await client.sendQueueMessage(createQueueMessage({ channel: 'q1', body: data }));
  await client.close();
  // Connection setup overhead on EVERY request!
}
```

## Performance Tips

### 1. Reuse the client instance

Create one `KubeMQClient` at application startup and share it across your application.
The client is safe for concurrent async operations.

```typescript
// app.ts — create once
export const kubemq = await KubeMQClient.create({ address: 'localhost:50000' });

// handler.ts — reuse everywhere
import { kubemq } from './app.js';
await kubemq.sendEvent(msg);
```

### 2. Use batching for high-throughput queue sends

`sendQueueMessagesBatch()` sends all messages in a single gRPC call,
significantly faster than sending them sequentially.

```typescript
const messages = items.map((item) => createQueueMessage({ channel: 'orders', body: item }));
await client.sendQueueMessagesBatch(messages);
```

### 3. Do not block subscription callbacks

Subscription callbacks run on the Node.js event loop. CPU-intensive
processing blocks all other operations.

```typescript
// GOOD: Offload heavy work
subscription.onEvent = async (msg) => {
  // Quick validation on event loop
  if (!isValid(msg)) return;
  // Heavy processing in a worker
  await workerPool.submit(() => processMessage(msg));
};
```

### 4. Close resources when done

Always call `subscription.cancel()` for subscriptions and `await client.close()`
when shutting down. This prevents resource leaks.

```typescript
// Using await using (Node.js 22+, TypeScript 5.2+)
await using client = await KubeMQClient.create({ address: 'localhost:50000' });
// client.close() called automatically

// Or explicit cleanup
const client = await KubeMQClient.create({ address: 'localhost:50000' });
try {
  // ... your code ...
} finally {
  await client.close();
}
```

### 5. Use `Uint8Array` for binary payloads

Passing `Uint8Array` bodies avoids string encoding overhead:

```typescript
// Faster — no encoding needed
const msg = createQueueMessage({ channel: 'ch', body: binaryData });

// Slower — requires UTF-8 encoding
const msg = createQueueMessage({ channel: 'ch', body: jsonString });
```

### 6. Avoid `JSON.parse()` in hot callback paths

Parse message bodies lazily, only when you need the data:

```typescript
subscription.onEvent = async (msg) => {
  // Only parse if you need the data
  if (shouldProcess(msg.channel)) {
    const data = JSON.parse(bodyToString(msg.body));
    await processData(data);
  }
};
```

### 7. Configure message size limits

Set `maxSendMessageSize` to prevent accidental oversized messages from
consuming excessive memory:

```typescript
const client = await KubeMQClient.create({
  address: 'localhost:50000',
  maxSendMessageSize: 10 * 1024 * 1024, // 10 MB limit
});
```

### 8. Use `Buffer.from(uint8.buffer, offset, length)` for zero-copy

When you need a Node.js `Buffer` from SDK message data, use zero-copy views:

```typescript
import { toBuffer } from 'kubemq-js';

// Zero-copy — shares underlying memory
const buf = toBuffer(msg.body);

// Copies data — avoid in hot paths
const buf = Buffer.from(msg.body); // DON'T
```

## Tuning Guidance

### Batch Size

Default batch size is limited by the gRPC max message size (100 MB by default).
For optimal throughput, target batches of 50–200 messages with 1–10 KB payloads.

| Payload Size | Recommended Batch Size | Expected Throughput  |
| ------------ | ---------------------- | -------------------- |
| < 1 KB       | 100–200 messages       | High                 |
| 1–10 KB      | 50–100 messages        | Medium-High          |
| 10–100 KB    | 10–50 messages         | Medium               |
| > 100 KB     | 1–10 messages          | Use individual sends |

### Keepalive Settings

The SDK configures gRPC keepalive by default:

```typescript
const client = await KubeMQClient.create({
  address: 'localhost:50000',
  keepalive: {
    timeMs: 10_000, // Send keepalive ping every 10s
    timeoutMs: 5_000, // Wait 5s for pong before considering dead
    permitWithoutCalls: true,
  },
});
```

For high-latency networks, increase `timeMs` and `timeoutMs`.

### Connection Timeout

Set `connectionTimeoutSeconds` for fast failure detection in environments
where the server may be temporarily unreachable:

```typescript
const client = await KubeMQClient.create({
  address: 'kubemq.prod:50000',
  connectionTimeoutSeconds: 5, // Fail fast if server unreachable
});
```

## Known Limitations

- **Max message size:** 100 MB default (configurable via `maxSendMessageSize` / `maxReceiveMessageSize`)
- **Max concurrent gRPC streams:** Limited by HTTP/2 settings (default 100 per connection)
- **gRPC-JS runtime:** Pure JavaScript — for maximum throughput, consider environments with native gRPC bindings (out of scope for this SDK)
- **Single-threaded:** Node.js event loop — CPU-bound processing in callbacks blocks all operations

## Node.js-Specific Guidance

### Event Loop

Never perform synchronous I/O or CPU-intensive work in subscription callbacks.
The SDK's internal timers, keepalive pings, and reconnection logic all depend
on a responsive event loop.

### Memory

For applications processing large volumes of messages:

```bash
node --max-old-space-size=4096 app.js
```

Monitor `process.memoryUsage()` to detect leaks.

### Worker Threads

For CPU-intensive message processing (encryption, compression, parsing),
offload to worker threads:

```typescript
import { Worker } from 'node:worker_threads';

subscription.onEvent = async (msg) => {
  const result = await runInWorker(msg.body);
  // ... handle result ...
};
```

### Timer Behavior

All internal SDK timers use `.unref()` to prevent blocking graceful
process exit. Your application's own timers should do the same for
SDK-related work:

```typescript
const timer = setTimeout(() => client.ping(), 30_000);
timer.unref(); // Won't prevent process.exit()
```

## Startup Optimization

1. **Create the client once at application startup** — not per-request
2. **Use `await using`** for automatic cleanup (Node.js 22+)
3. **TLS certificates load asynchronously** — no event loop blocking
4. **Import only what you need:**

```typescript
import { KubeMQClient, createEventMessage } from 'kubemq-js';
```
