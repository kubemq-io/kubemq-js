# KubeMQ SDK for Node.js / TypeScript

[![npm version](https://img.shields.io/npm/v/kubemq-js.svg)](https://www.npmjs.com/package/kubemq-js)
[![CI](https://github.com/kubemq-io/kubemq-js/actions/workflows/ci.yml/badge.svg)](https://github.com/kubemq-io/kubemq-js/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/kubemq-io/kubemq-js/branch/main/graph/badge.svg)](https://codecov.io/gh/kubemq-io/kubemq-js)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

The official TypeScript/JavaScript client for [KubeMQ](https://kubemq.io/) — a Kubernetes-native message broker for microservices. This SDK provides a unified client for all messaging patterns (Events, Events Store, Queues, Commands, and Queries) with TypeScript-first types, auto-retry, structured error handling, and OpenTelemetry integration.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
  - [Events (fire-and-forget)](#events-fire-and-forget)
  - [Queues (guaranteed delivery)](#queues-guaranteed-delivery)
  - [RPC (request/reply)](#rpc-requestreply)
- [Messaging Patterns](#messaging-patterns)
- [Configuration](#configuration)
- [Error Handling](#error-handling)
- [Troubleshooting](#troubleshooting)
- [Requirements](#requirements)
- [Deprecation Policy](#deprecation-policy)
- [Version Lifecycle](#version-lifecycle)
  - [Current Version Status](#current-version-status)
- [Security](#security)
- [Additional Resources](#additional-resources)
- [Contributing](#contributing)
- [License](#license)

## Installation

```bash
npm install kubemq-js
```

**Prerequisites:**

- Node.js 20 or later (22, 24 also supported)
- A running KubeMQ server (default: `localhost:50000`)

## Quick Start

### Events (fire-and-forget)

```typescript
import { KubeMQClient, createEventMessage } from 'kubemq-js';

const client = await KubeMQClient.create({ address: 'localhost:50000' });

// Subscribe
client.subscribeToEvents({
  channel: 'events.hello',
  onMessage: (msg) => console.log('Received:', new TextDecoder().decode(msg.body)),
  onError: (err) => console.error('Error:', err.message),
});

// Publish
await client.publishEvent(createEventMessage({ channel: 'events.hello', body: 'Hello KubeMQ!' }));
```

### Queues (guaranteed delivery)

```typescript
import { KubeMQClient, createQueueMessage } from 'kubemq-js';

const client = await KubeMQClient.create({ address: 'localhost:50000' });

// Send
await client.sendQueueMessage(
  createQueueMessage({ channel: 'queues.tasks', body: 'Process this' }),
);

// Receive
const messages = await client.receiveQueueMessages({
  channel: 'queues.tasks',
  visibilitySeconds: 30,
  waitTimeoutSeconds: 5,
});
for (const msg of messages) {
  console.log('Task:', new TextDecoder().decode(msg.body));
  await msg.ack();
}
```

### RPC (request/reply)

```typescript
import { KubeMQClient, createCommand } from 'kubemq-js';

const client = await KubeMQClient.create({ address: 'localhost:50000' });

// Handle commands
client.subscribeToCommands({
  channel: 'commands.greet',
  onCommand: (cmd) => client.sendCommandResponse({ requestId: cmd.id, isExecuted: true }),
  onError: (err) => console.error(err.message),
});

// Send command
const response = await client.sendCommand(
  createCommand({ channel: 'commands.greet', body: 'Hi', timeoutMs: 5000 }),
);
console.log('Executed:', response.isExecuted);
```

**Expected output:**

```
Received: Hello KubeMQ!
Task: Process this
Executed: true
```

## Messaging Patterns

| Pattern                                                                                | Delivery Guarantee           | Use When                                                           | Example Use Case                       |
| -------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------ | -------------------------------------- |
| [Events](https://github.com/kubemq-io/kubemq-js/tree/main/examples/events)             | At-most-once                 | Fire-and-forget broadcasting to multiple subscribers               | Real-time notifications, log streaming |
| [Events Store](https://github.com/kubemq-io/kubemq-js/tree/main/examples/events-store) | At-least-once (persistent)   | Subscribers must not miss messages, even if offline                | Audit trails, event sourcing, replay   |
| [Queues](https://github.com/kubemq-io/kubemq-js/tree/main/examples/queues)             | At-least-once (with ack)     | Work must be processed exactly by one consumer with acknowledgment | Job processing, task distribution      |
| [Commands](https://github.com/kubemq-io/kubemq-js/tree/main/examples/rpc)              | At-most-once (request/reply) | You need a response confirming the action was executed             | Device control, configuration changes  |
| [Queries](https://github.com/kubemq-io/kubemq-js/tree/main/examples/rpc)               | At-most-once (request/reply) | You need to retrieve data from a responder                         | Data lookups, service-to-service reads |

See the [examples directory](https://github.com/kubemq-io/kubemq-js/tree/main/examples) for 27 runnable examples covering all patterns and configuration options.

## Configuration

The `KubeMQClient.create()` factory accepts a `ClientOptions` object:

| Option                | Type                           | Default                  | Description                                        |
| --------------------- | ------------------------------ | ------------------------ | -------------------------------------------------- |
| `address`             | `string`                       | _(required)_             | KubeMQ server address (`host:port`)                |
| `clientId`            | `string`                       | Auto-generated UUID      | Unique client identifier                           |
| `credentials`         | `CredentialProvider \| string` | `undefined`              | Authentication token or provider                   |
| `tls`                 | `TlsOptions \| boolean`        | Smart default            | TLS configuration (auto-enabled for non-localhost) |
| `retry`               | `RetryPolicy`                  | 3 retries, 500ms initial | Auto-retry policy for transient errors             |
| `reconnect`           | `ReconnectionPolicy`           | Unlimited, 500ms initial | Auto-reconnection policy                           |
| `connectionTimeoutMs` | `number`                       | `10000`                  | Connection establishment timeout (ms)              |
| `logger`              | `Logger`                       | `noopLogger`             | Structured logging interface                       |
| `tracerProvider`      | `TracerProvider`               | No-op                    | OpenTelemetry tracer for distributed tracing       |

```typescript
import { KubeMQClient, createConsoleLogger } from 'kubemq-js';

const client = await KubeMQClient.create({
  address: 'kubemq-server:50000',
  credentials: 'my-auth-token',
  tls: { enabled: true, caCert: '/path/to/ca.pem' },
  retry: {
    maxRetries: 5,
    initialBackoffMs: 1000,
    maxBackoffMs: 30_000,
    multiplier: 2.0,
    jitter: 'full',
  },
  logger: createConsoleLogger('info'),
});
```

## Error Handling

All SDK errors extend `KubeMQError` with a typed hierarchy of 19 subclasses. Every error carries an `isRetryable` flag, a machine-readable `code`, and an optional `suggestion` for the fix.

```typescript
import { KubeMQError, ConnectionError, ValidationError } from 'kubemq-js';

try {
  await client.publishEvent(msg);
} catch (err) {
  if (err instanceof ConnectionError) {
    console.log('Server unreachable, will auto-retry');
  } else if (err instanceof ValidationError) {
    console.log('Fix the message:', err.suggestion);
  }
}
```

The SDK automatically retries transient errors (connection drops, timeouts, throttling) using exponential backoff with jitter. Permanent errors (validation, auth, not-found) are thrown immediately.

See the [Error Handling Guide](https://github.com/kubemq-io/kubemq-js/blob/main/docs/ERROR-HANDLING.md) for the full error hierarchy, retry configuration, and best practices.

## Troubleshooting

| Problem                            | Solution                                                                     |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| **Connection refused**             | Verify KubeMQ server is running on the configured address                    |
| **Authentication failed**          | Check your auth token or TLS certificates                                    |
| **Message too large**              | Default limit is 100 MB; configure `maxSendMessageSize`                      |
| **No messages received**           | Ensure subscriber is connected before publisher sends                        |
| **Queue message not acknowledged** | Messages reappear after visibility timeout expires — always call `msg.ack()` |

See the [Troubleshooting Guide](https://github.com/kubemq-io/kubemq-js/blob/main/docs/TROUBLESHOOTING.md) for 11 detailed problem/solution entries with exact error messages.

## Requirements

- **Node.js:** ≥20.11.0 (20.x maintenance LTS, 22.x active LTS, or 24.x current)
- **TypeScript:** ≥ 5.0 (optional — the SDK ships compiled JS with `.d.ts` declarations)

> Node.js 14, 16, and 18 are no longer supported in v3.x. See the
> [migration guide](./docs/MIGRATION-v3.md) for details.

## Deprecation Policy

- Deprecated APIs are annotated with `@deprecated` TSDoc tags
- Each deprecation notice names the replacement API
- Deprecated APIs receive a minimum of **2 minor versions** or **6 months** notice
  before removal, whichever is longer
- Deprecated APIs continue to function until removal
- All deprecations are recorded in [CHANGELOG.md](./CHANGELOG.md)
- Removed APIs are documented in migration guides (see [docs/MIGRATION-v3.md](./docs/MIGRATION-v3.md))

## Version Lifecycle

When a new major version of kubemq-js reaches General Availability (GA),
the previous major version enters a **security-only** maintenance window:

| Phase         | Duration                      | What's Included                       |
| ------------- | ----------------------------- | ------------------------------------- |
| Active        | Until next major GA           | Features, bug fixes, security patches |
| Security-only | 12 months after next major GA | Critical security patches only        |
| End of Life   | After security-only window    | No updates; upgrade recommended       |

### Current Version Status

| Version | Status        | Security Support Until  |
| ------- | ------------- | ----------------------- |
| v3.x    | **Active**    | —                       |
| v2.x    | Security-only | 12 months after v3.0 GA |
| v1.x    | End of Life   | No longer supported     |

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting. The SDK supports TLS and mTLS connections — for configuration details, see [How to Connect with TLS](docs/how-to/connect-with-tls.md).

## Additional Resources

- [KubeMQ Documentation](https://docs.kubemq.io/) — Official KubeMQ documentation and guides
- [Full Documentation Index](docs/INDEX.md) — Complete SDK documentation index
- [KubeMQ Concepts](docs/CONCEPTS.md) — Core KubeMQ messaging concepts
- [SDK Feature Parity Matrix](../sdk-feature-parity-matrix.md) — Cross-SDK feature comparison
- [CHANGELOG.md](./CHANGELOG.md) — Release history
- [TROUBLESHOOTING.md](https://github.com/kubemq-io/kubemq-js/blob/main/docs/TROUBLESHOOTING.md) — Common issues and solutions
- [Examples](https://github.com/kubemq-io/kubemq-js/tree/main/examples) — Runnable code examples for all patterns

## Contributing

See [CONTRIBUTING.md](https://github.com/kubemq-io/kubemq-js/blob/main/CONTRIBUTING.md) for development setup, coding standards, and PR guidelines.

## License

Apache 2.0 — see [LICENSE](https://github.com/kubemq-io/kubemq-js/blob/main/LICENSE) for details.
