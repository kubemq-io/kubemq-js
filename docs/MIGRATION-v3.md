# Migration Guide: v2 → v3

## Overview

KubeMQ JS/TS SDK v3 is a major release that unifies the three separate client classes into a single `KubeMQClient`, introduces a typed error hierarchy, adds ESM support, and modernizes the API surface. This guide walks you through every breaking change and provides before/after code examples for each.

**Why v3 exists:**

- Unified client — one `KubeMQClient` replaces `PubsubClient`, `CQClient`, and `QueuesClient`
- Typed error handling — 19 error subclasses with `isRetryable` classification replace raw `Error` and gRPC `ServiceError`
- ESM-first — dual ESM + CJS build with conditional exports
- TypeScript strict mode — full `strict: true` compilation
- Silent by default — no `console.log/error/debug` calls; inject a `Logger` for diagnostics
- Auto-retry and reconnection — built-in exponential backoff with jitter

**Estimated migration effort:** 1–3 hours for a typical application, depending on the number of messaging patterns used.

## Breaking Changes Table

| #   | Area             | v2 Behavior                                                             | v3 Behavior                                       | Migration Action                  |
| --- | ---------------- | ----------------------------------------------------------------------- | ------------------------------------------------- | --------------------------------- |
| 1   | Client classes   | 3 separate classes (`PubsubClient`, `CQClient`, `QueuesClient`)         | Single `KubeMQClient`                             | Replace all client instantiation  |
| 2   | Client creation  | `new PubsubClient(config)` (sync)                                       | `await KubeMQClient.create(options)` (async)      | Add `await`, update options shape |
| 3   | Error types      | Raw `Error` and gRPC `ServiceError`                                     | Typed `KubeMQError` hierarchy with `isRetryable`  | Update catch blocks               |
| 4   | Error callbacks  | `onErrorCallback?: (error: string) => void`                             | `onError: (err: KubeMQError) => void`             | Update callback signature         |
| 5   | Auth config      | `authToken: string` flat field                                          | `credentials: CredentialProvider \| string`       | Rename field                      |
| 6   | TLS config       | 4 separate fields (`tls`, `tlsCertFile`, `tlsKeyFile`, `tlsCaCertFile`) | Single `tls: TlsOptions \| boolean` nested object | Restructure TLS config            |
| 7   | TLS default      | Always `false`                                                          | Smart default: `true` for non-localhost addresses | Review TLS expectations           |
| 8   | Cert validation  | Deferred to first RPC                                                   | Fail-fast at `create()`                           | Expect errors at creation time    |
| 9   | Console output   | 65 `console.log/error/debug` calls in production                        | Silent by default (`noopLogger`)                  | Remove console output workarounds |
| 10  | Config shape     | `Config` interface (10 optional fields)                                 | `ClientOptions` with validated defaults           | Rename fields, update structure   |
| 11  | Method names     | `sendEventsMessage()`, `sendEventStoreMessage()`                        | `sendEvent()`, `sendEventStore()`                 | Rename method calls               |
| 12  | Message creation | Object literals with `Utils.stringToBytes()`                            | Factory functions: `createEventMessage()`, etc.   | Use factory functions             |
| 13  | Subscriptions    | Callback on request class, `onErrorCallback` optional                   | `onEvent` + `onError` callbacks in options object | Restructure subscription code     |
| 14  | Module format    | CommonJS only                                                           | ESM-first with CJS compatibility                  | Update import syntax if needed    |
| 15  | Node.js version  | `>=14.0.0`                                                              | `>=20.11.0`                                       | Upgrade Node.js                   |
| 16  | Close semantics  | `client.close()` (sync, no drain)                                       | `await client.close()` (async, drains in-flight)  | Add `await`                       |
| 17  | Timeouts         | No timeouts (infinite by default)                                       | Default timeouts (5s send, 10s RPC)               | Review timeout expectations       |

## Step-by-Step Upgrade Procedure

### Step 1: Update Node.js

v3 requires Node.js 20.11.0 or later.

- **Minimum:** Node.js 20
- **Recommended:** Node.js 22 (LTS)

Check your version: `node --version`

### Step 2: Update the Package

```bash
npm install kubemq-js@3
```

### Step 3: Replace Client Instantiation

**v2:**

```typescript
import { PubsubClient, CQClient, QueuesClient, Config, Utils } from 'kubemq-js';

const config: Config = {
  address: 'localhost:50000',
  clientId: Utils.uuid(),
  reconnectIntervalSeconds: 1,
};

const pubsubClient = new PubsubClient(config);
const cqClient = new CQClient(config);
const queuesClient = new QueuesClient(config);
```

**v3:**

```typescript
import { KubeMQClient } from 'kubemq-js';

const client = await KubeMQClient.create({
  address: 'localhost:50000',
});
```

Key differences:

- One client for all patterns — no need to create three separate instances
- `clientId` is auto-generated (UUID) by default — you can still set it explicitly
- Creation is async — the client validates configuration and connects at creation time
- `Config` is replaced by `ClientOptions` — see Step 7 for field mapping

### Step 4: Update Message Creation

**v2 — Events:**

```typescript
await pubsubClient.sendEventsMessage({
  id: '234',
  channel: 'events.single',
  body: Utils.stringToBytes('event message'),
});
```

**v3 — Events:**

```typescript
import { createEventMessage } from 'kubemq-js';

await client.sendEvent(createEventMessage({ channel: 'events.single', body: 'event message' }));
```

**v2 — Events Store:**

```typescript
await pubsubClient.sendEventStoreMessage({
  id: '987',
  channel: 'events_store.single',
  body: Utils.stringToBytes('event store message'),
});
```

**v3 — Events Store:**

```typescript
import { createEventStoreMessage } from 'kubemq-js';

await client.sendEventStore(
  createEventStoreMessage({ channel: 'events_store.single', body: 'event store message' }),
);
```

**v2 — Queues:**

```typescript
await queuesClient.sendQueuesMessage({
  channel: 'queues.single',
  body: Utils.stringToBytes('queue message'),
});
```

**v3 — Queues:**

```typescript
import { createQueueMessage } from 'kubemq-js';

await client.sendQueueMessage(
  createQueueMessage({ channel: 'queues.single', body: 'queue message' }),
);
```

**v2 — Commands:**

```typescript
const response = await cqClient.sendCommandRequest({
  channel: 'commands.test',
  body: Utils.stringToBytes('command body'),
  timeout: 10000,
});
```

**v3 — Commands:**

```typescript
import { createCommand } from 'kubemq-js';

const response = await client.sendCommand(
  createCommand({ channel: 'commands.test', body: 'command body', timeoutInSeconds: 10 }),
);
```

**v2 — Queries:**

```typescript
const response = await cqClient.sendQueryRequest({
  channel: 'queries.test',
  body: Utils.stringToBytes('query body'),
  timeout: 10000,
});
```

**v3 — Queries:**

```typescript
import { createQuery } from 'kubemq-js';

const response = await client.sendQuery(
  createQuery({ channel: 'queries.test', body: 'query body', timeoutInSeconds: 10 }),
);
```

Key differences:

- `Utils.stringToBytes()` is no longer needed — factory functions accept `string` directly for `body`
- Method names changed: `sendEventsMessage` → `sendEvent`, `sendEventStoreMessage` → `sendEventStore`
- Use factory functions (`createEventMessage`, etc.) instead of plain object literals

### Step 5: Update Subscriptions

**v2 — Events:**

```typescript
const request = new EventsSubscriptionRequest('events.A', '');

request.onReceiveEventCallback = (event: EventMessageReceived) => {
  console.log('Received:', event);
};

request.onErrorCallback = (error: string) => {
  console.error('Error:', error);
};

await pubsubClient.subscribeToEvents(request);
```

**v3 — Events:**

```typescript
const subscription = client.subscribeToEvents({
  channel: 'events.A',
  onEvent: (event) => {
    console.log('Received:', new TextDecoder().decode(event.body));
  },
  onError: (err) => {
    console.error('Error:', err.message);
  },
});

// Cancel when done:
subscription.cancel();
```

**v2 — Events Store:**

```typescript
const request = new EventsStoreSubscriptionRequest('events_store.A', '');
request.eventsStoreType = EventStoreType.StartAtSequence;
request.eventsStoreSequenceValue = 1;

request.onReceiveEventCallback = (event: EventStoreMessageReceived) => {
  console.log('Received:', event);
};

request.onErrorCallback = (error: string) => {
  console.error('Error:', error);
};

await pubsubClient.subscribeToEvents(request);
```

**v3 — Events Store:**

```typescript
import { EventStoreStartPosition } from 'kubemq-js';

const subscription = client.subscribeToEventsStore({
  channel: 'events_store.A',
  startFrom: EventStoreStartPosition.StartAtSequence,
  startValue: 1,
  onEvent: (event) => {
    console.log('Received:', new TextDecoder().decode(event.body), 'seq:', event.sequence);
  },
  onError: (err) => {
    console.error('Error:', err.message);
  },
});
```

**v2 — Commands:**

```typescript
const request = new CommandsSubscriptionRequest('commands.greet', 'group1');

request.onReceiveEventCallback = (cmd: CommandMessageReceived) => {
  console.log('Received command:', cmd);
};

request.onErrorCallback = (error: string) => {
  console.error('Error:', error);
};

await cqClient.subscribeToCommands(request);
```

**v3 — Commands:**

```typescript
const subscription = client.subscribeToCommands({
  channel: 'commands.greet',
  group: 'group1',
  onCommand: (cmd) => {
    console.log('Received command:', cmd.id);
    client.sendCommandResponse({ requestId: cmd.id, isExecuted: true });
  },
  onError: (err) => {
    console.error('Subscription error:', err.message);
  },
});
```

Key differences:

- Subscription request classes (`EventsSubscriptionRequest`, etc.) replaced with plain options objects
- `onReceiveEventCallback` → `onEvent` (events) or `onCommand` / `onQuery` (RPC)
- `onErrorCallback` (optional, received `string`) → `onError` (mandatory, receives `KubeMQError`)
- Subscriptions return a `Subscription` handle with a `.cancel()` method

### Step 6: Update Error Handling

**v2:**

```typescript
try {
  await pubsubClient.sendEventsMessage(msg);
} catch (err) {
  // err is Error or gRPC ServiceError — no way to distinguish programmatically
  console.error(err.message);
}
```

**v3:**

```typescript
import { KubeMQError, ConnectionError, ValidationError } from 'kubemq-js';

try {
  await client.sendEvent(msg);
} catch (err) {
  if (err instanceof ConnectionError && err.isRetryable) {
    // Transient — SDK already retried 3 times per default policy.
    console.error('Server unreachable after retries:', err.message);
  } else if (err instanceof ValidationError) {
    // Permanent — fix the message.
    console.error('Fix message:', err.suggestion);
  }
}
```

Key differences:

- All errors extend `KubeMQError` with typed subclasses
- `isRetryable` tells you whether the error is transient
- `err.code` provides a machine-readable error code
- `err.suggestion` provides an actionable fix recommendation
- `err.requestId` provides a UUID for log correlation

### Step 7: Update Configuration

**v2:**

```typescript
const config: Config = {
  address: 'localhost:50000',
  clientId: 'my-client',
  authToken: 'my-jwt-token',
  tls: true,
  tlsCertFile: '/path/to/cert.pem',
  tlsKeyFile: '/path/to/key.pem',
  tlsCaCertFile: '/path/to/ca.pem',
  maxReceiveSize: 1024 * 1024 * 100,
  reconnectIntervalSeconds: 1,
};
```

**v3:**

```typescript
import type { ClientOptions } from 'kubemq-js';

const options: ClientOptions = {
  address: 'localhost:50000',
  clientId: 'my-client',
  credentials: 'my-jwt-token',
  tls: {
    enabled: true,
    clientCert: '/path/to/cert.pem',
    clientKey: '/path/to/key.pem',
    caCert: '/path/to/ca.pem',
  },
  reconnect: {
    maxAttempts: -1,
    initialDelayMs: 1000,
    maxDelayMs: 30_000,
    multiplier: 2.0,
    jitter: 'full',
  },
};
```

Field mapping:

| v2 Field                   | v3 Field                        | Notes                                    |
| -------------------------- | ------------------------------- | ---------------------------------------- |
| `address`                  | `address`                       | Unchanged                                |
| `clientId`                 | `clientId`                      | Now optional, auto-generated UUID        |
| `authToken`                | `credentials`                   | Accepts `string` or `CredentialProvider` |
| `tls` (boolean)            | `tls` (`TlsOptions \| boolean`) | Nested object or `true`/`false`          |
| `tlsCertFile`              | `tls.clientCert`                | Inside `TlsOptions`                      |
| `tlsKeyFile`               | `tls.clientKey`                 | Inside `TlsOptions`                      |
| `tlsCaCertFile`            | `tls.caCert`                    | Inside `TlsOptions`                      |
| `maxReceiveSize`           | `maxReceiveMessageSize`         | Renamed                                  |
| `reconnectIntervalSeconds` | `reconnect`                     | Full `ReconnectionPolicy` object         |

### Step 8: Remove Console Output Workarounds

In v2, the SDK produced console output through 65 `console.log/error/debug` calls. If you were suppressing this output, you can remove those workarounds.

**v3 behavior:** The SDK is silent by default (uses `noopLogger`). To enable logging, inject a `Logger`:

```typescript
import { KubeMQClient, createConsoleLogger } from 'kubemq-js';

const client = await KubeMQClient.create({
  address: 'localhost:50000',
  logger: createConsoleLogger('info'),
});
```

### Step 9: Update Close Calls

**v2:**

```typescript
pubsubClient.close(); // sync, no drain
cqClient.close();
queuesClient.close();
```

**v3:**

```typescript
await client.close(); // async, drains in-flight operations
```

Or use `AsyncDisposable` (Node.js 20+):

```typescript
await using client = await KubeMQClient.create({ address: 'localhost:50000' });
// client.close() is called automatically when the scope exits
```

## Removed APIs

| v2 API                                 | v3 Replacement                                         | Notes                                  |
| -------------------------------------- | ------------------------------------------------------ | -------------------------------------- |
| `PubsubClient`                         | `KubeMQClient`                                         | Unified client                         |
| `CQClient`                             | `KubeMQClient`                                         | Unified client                         |
| `QueuesClient`                         | `KubeMQClient`                                         | Unified client                         |
| `Config` interface                     | `ClientOptions`                                        | New fields, renamed fields             |
| `Utils.stringToBytes()`                | `new TextEncoder().encode()` or pass `string` directly | Factory functions accept `string` body |
| `Utils.bytesToString()`                | `new TextDecoder().decode()`                           | Standard Web API                       |
| `Utils.uuid()`                         | `crypto.randomUUID()`                                  | Node.js built-in                       |
| `EventsSubscriptionRequest` class      | Options object passed to `subscribeToEvents()`         | Simplified API                         |
| `EventsStoreSubscriptionRequest` class | Options object passed to `subscribeToEventsStore()`    | Simplified API                         |
| `CommandsSubscriptionRequest` class    | Options object passed to `subscribeToCommands()`       | Simplified API                         |
| `QueriesSubscriptionRequest` class     | Options object passed to `subscribeToQueries()`        | Simplified API                         |
| `EventsSendResult`                     | Method returns `Promise<void>`                         | No result object for fire-and-forget   |
| `TypedEvent` class                     | Removed (dead code)                                    | Not replaced                           |

## TLS Configuration

**v2:**

```typescript
const config: Config = {
  address: 'kubemq-server:50000',
  clientId: 'my-client',
  tls: true,
  tlsCertFile: 'path/to/client-cert.pem',
  tlsKeyFile: 'path/to/client-key.pem',
  tlsCaCertFile: 'path/to/ca-cert.pem',
};
```

**v3:**

```typescript
const client = await KubeMQClient.create({
  address: 'kubemq-server:50000',
  tls: {
    enabled: true,
    caCert: 'path/to/ca-cert.pem',
    clientCert: 'path/to/client-cert.pem',
    clientKey: 'path/to/client-key.pem',
  },
});
```

Note: For non-localhost addresses, TLS is enabled by default in v3. You can pass `tls: false` to explicitly disable it if needed.

## Node.js Version Requirements

v3.x requires Node.js 20.11.0 or later. Node.js 14, 16, and 18 are no longer supported.

**Why:** Node.js 18 reached end-of-life in April 2025. The SDK now targets
ES2022 features (`Error.cause`, structured clone) available in Node.js 20+.

**Action:** Upgrade your Node.js runtime to 20.x, 22.x, or 24.x before
upgrading to kubemq-js v3.x.

See [COMPATIBILITY.md](../COMPATIBILITY.md) for the full version matrix and
feature availability table.

## FAQ

**Q: Can I use v2 and v3 side by side?**

A: Not in the same process — both install as `kubemq-js`. If you need both, use npm aliases:

```bash
npm install kubemq-v2@npm:kubemq-js@2
npm install kubemq-js@3
```

Then import each by its alias. However, we recommend migrating fully to v3.

**Q: Do I need to change my KubeMQ server version?**

A: No. The v3 SDK is wire-compatible with the same KubeMQ server versions that v2 supported. The breaking changes are client-side only.

**Q: What if I only use queues?**

A: You still use `KubeMQClient` — it handles all patterns. The migration is the same: replace `new QueuesClient(config)` with `await KubeMQClient.create(options)`, then update method names and message creation.

**Q: What about the `rxjs` dependency?**

A: It has been removed. The v2 SDK listed `rxjs` as a dependency but never used it. v3 has only 3 production dependencies: `@grpc/grpc-js`, `@grpc/proto-loader`, and `google-protobuf`.

**Q: How do I handle the new default timeouts?**

A: v2 had no default timeouts (infinite). v3 defaults to 5s for send operations and 10s for RPC (commands/queries). If your operations need more time, set a per-operation timeout:

```typescript
await client.sendCommand(cmd, { timeout: 30_000 });
```

## Related Resources

- [CHANGELOG](https://github.com/kubemq-io/kubemq-js/blob/main/CHANGELOG.md) — full list of changes in v3.0.0
- [Error Handling Guide](https://github.com/kubemq-io/kubemq-js/blob/main/docs/ERROR-HANDLING.md) — deep dive into the error hierarchy
- [Troubleshooting Guide](https://github.com/kubemq-io/kubemq-js/blob/main/docs/TROUBLESHOOTING.md) — solutions for common issues
- [Examples](https://github.com/kubemq-io/kubemq-js/tree/main/examples) — working code for all messaging patterns
