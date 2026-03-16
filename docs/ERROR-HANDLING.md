# Error Handling Guide

This guide explains how errors work in the KubeMQ JS/TS SDK v3 and how to handle them effectively in your application.

## Overview

All SDK errors extend the base `KubeMQError` class. This provides a consistent, typed error hierarchy that makes it straightforward to distinguish transient network issues from permanent validation failures and handle each appropriately.

### Error Hierarchy

```
KubeMQError (base)
├── ConnectionError          — Cannot reach the KubeMQ server
├── AuthenticationError      — Invalid credentials or expired token
├── AuthorizationError       — Insufficient permissions for the operation
├── KubeMQTimeoutError       — Operation exceeded its deadline
├── ValidationError          — Invalid input (message, config, etc.)
├── TransientError           — Temporary server-side failure
├── ThrottlingError          — Rate-limited by the server
├── NotFoundError            — Channel or resource does not exist
├── FatalError               — Unrecoverable server error
├── CancellationError        — Operation cancelled via AbortSignal
├── BufferFullError          — Reconnect buffer capacity exceeded
├── StreamBrokenError        — gRPC stream dropped unexpectedly
├── ClientClosedError        — Operation attempted after client.close()
├── ConnectionNotReadyError  — Operation attempted before READY state
├── ConfigurationError       — Invalid ClientOptions
├── RetryExhaustedError      — All retry attempts failed
├── NotImplementedError      — Method stub not yet migrated
├── PartialFailureError      — Batch operation partially succeeded
└── HandlerError             — Exception thrown inside a user callback
```

## Error Classification

Every `KubeMQError` carries an `isRetryable` flag that indicates whether the operation can be meaningfully retried:

| Error Class               | Code                   | Category       | `isRetryable` | When It Occurs                             |
| ------------------------- | ---------------------- | -------------- | ------------- | ------------------------------------------ |
| `ConnectionError`         | `CONNECTION_TIMEOUT`   | Transient      | `true`        | Server unreachable or connection dropped   |
| `AuthenticationError`     | `AUTH_FAILED`          | Authentication | `false`       | Invalid or expired auth token              |
| `AuthorizationError`      | `PERMISSION_DENIED`    | Authorization  | `false`       | Insufficient permissions for the operation |
| `KubeMQTimeoutError`      | `TIMEOUT`              | Timeout        | `true`        | Operation exceeded deadline                |
| `ValidationError`         | `VALIDATION_FAILED`    | Validation     | `false`       | Invalid message or configuration input     |
| `TransientError`          | `UNAVAILABLE`          | Transient      | `true`        | Temporary server-side failure              |
| `ThrottlingError`         | `THROTTLED`            | Throttling     | `true`        | Server rate-limiting                       |
| `NotFoundError`           | `NOT_FOUND`            | NotFound       | `false`       | Channel or resource does not exist         |
| `FatalError`              | `FATAL`                | Fatal          | `false`       | Unrecoverable internal server error        |
| `CancellationError`       | `CANCELLED`            | Cancellation   | `false`       | Cancelled by `AbortSignal`                 |
| `BufferFullError`         | `BUFFER_FULL`          | Backpressure   | `false`       | Reconnect message buffer is full           |
| `StreamBrokenError`       | `STREAM_BROKEN`        | Transient      | `true`        | gRPC stream unexpectedly terminated        |
| `ClientClosedError`       | `CLIENT_CLOSED`        | Fatal          | `false`       | Client already closed                      |
| `ConnectionNotReadyError` | `CONNECTION_NOT_READY` | Transient      | `true`        | Connection not yet in READY state          |
| `ConfigurationError`      | `CONFIGURATION_ERROR`  | Configuration  | `false`       | Invalid `ClientOptions`                    |
| `RetryExhaustedError`     | `RETRY_EXHAUSTED`      | Transient      | `false`       | All retry attempts exhausted               |
| `PartialFailureError`     | varies                 | varies         | `false`       | Some messages in a batch failed            |
| `HandlerError`            | varies                 | varies         | `false`       | Exception inside a user callback           |

## Handling Errors in Your Code

### Basic try/catch

The simplest approach checks `isRetryable` to decide whether to retry or escalate:

```typescript
import { KubeMQError } from 'kubemq-js';

try {
  await client.publishEvent(msg);
} catch (err) {
  if (err instanceof KubeMQError) {
    if (err.isRetryable) {
      console.warn(`Transient error (will be auto-retried): ${err.message}`);
    } else {
      console.error(`Permanent error — fix before retrying: ${err.message}`);
    }
  }
}
```

### Specific Error Types

Use `instanceof` checks when you need different handling per error type:

```typescript
import {
  KubeMQError,
  ConnectionError,
  AuthenticationError,
  ValidationError,
  KubeMQTimeoutError,
  ClientClosedError,
} from 'kubemq-js';

try {
  await client.publishEvent(msg);
} catch (err) {
  if (err instanceof ConnectionError) {
    // Server unreachable — SDK already retried per RetryPolicy.
    console.error('Server unreachable after retries:', err.message);
  } else if (err instanceof AuthenticationError) {
    // Credentials invalid — prompt user to re-authenticate.
    console.error('Auth failed:', err.message);
  } else if (err instanceof ValidationError) {
    // Message is malformed — fix the input.
    console.error('Invalid message:', err.suggestion);
  } else if (err instanceof KubeMQTimeoutError) {
    // Deadline exceeded — consider increasing the timeout.
    console.error('Operation timed out:', err.message);
  } else if (err instanceof ClientClosedError) {
    // Client was closed — recreate it if needed.
    console.error('Client is closed:', err.message);
  }
}
```

### Error Properties

Every `KubeMQError` exposes these properties for diagnostics and log correlation:

| Property      | Type                  | Description                                               |
| ------------- | --------------------- | --------------------------------------------------------- |
| `code`        | `ErrorCode`           | Machine-readable error code (e.g., `CONNECTION_TIMEOUT`)  |
| `message`     | `string`              | Human-readable description                                |
| `operation`   | `string`              | SDK method that produced the error (e.g., `publishEvent`) |
| `channel`     | `string \| undefined` | The channel or queue involved, if applicable              |
| `cause`       | `Error \| undefined`  | Underlying error (ES2022 `Error.cause`)                   |
| `suggestion`  | `string \| undefined` | Actionable fix recommendation                             |
| `isRetryable` | `boolean`             | Whether auto-retry would help                             |
| `requestId`   | `string`              | UUID for log correlation across services                  |

## Auto-Retry Behavior

The SDK includes a built-in retry engine that automatically retries transient errors.

### Default Retry Policy

| Setting            | Default | Description                                |
| ------------------ | ------- | ------------------------------------------ |
| `maxRetries`       | `3`     | Maximum retry attempts                     |
| `initialBackoffMs` | `500`   | First retry delay                          |
| `maxBackoffMs`     | `30000` | Maximum delay cap                          |
| `multiplier`       | `2.0`   | Exponential multiplier                     |
| `jitter`           | `full`  | Full jitter for thundering-herd prevention |

### Which Errors Trigger Retry

Only errors where `isRetryable === true` trigger automatic retry:

- `ConnectionError` — server unreachable, connection dropped
- `TransientError` — temporary server failure (gRPC `UNAVAILABLE`)
- `KubeMQTimeoutError` — deadline exceeded
- `ThrottlingError` — rate limited by server
- `StreamBrokenError` — gRPC stream dropped
- `ConnectionNotReadyError` — connection not yet in READY state

### Which Errors Do NOT Retry

Permanent errors are thrown immediately without retry:

- `ValidationError` — fix the input
- `AuthenticationError` — update credentials
- `AuthorizationError` — request proper permissions
- `NotFoundError` — create the channel first
- `ConfigurationError` — fix `ClientOptions`
- `FatalError` — unrecoverable server error
- `CancellationError` — explicitly cancelled
- `ClientClosedError` — client already shut down

### Customizing Retry Policy

Pass a `retry` option when creating the client:

```typescript
const client = await KubeMQClient.create({
  address: 'localhost:50000',
  retry: {
    maxRetries: 5,
    initialBackoffMs: 1000,
    maxBackoffMs: 60_000,
    multiplier: 2.0,
    jitter: 'full',
  },
});
```

### Disabling Retry

Set `maxRetries` to `0` to disable automatic retry entirely:

```typescript
const client = await KubeMQClient.create({
  address: 'localhost:50000',
  retry: { maxRetries: 0, initialBackoffMs: 0, maxBackoffMs: 0, multiplier: 1, jitter: 'none' },
});
```

## Subscription Error Handling

### Mandatory `onError` Callback

All subscription methods require an `onError` callback. If a transport error occurs (e.g., the stream drops), the SDK invokes `onError` rather than throwing:

```typescript
client.subscribeToEvents({
  channel: 'notifications',
  onMessage: (event) => {
    console.log('Received:', new TextDecoder().decode(event.body));
  },
  onError: (err) => {
    // Transport errors (stream drops, reconnection failures) arrive here.
    console.error('Subscription error:', err.message);
    // The SDK will attempt automatic reconnection for transient errors.
  },
});
```

### Handler Error Isolation

If your `onMessage` callback throws, the SDK catches the exception and wraps it in a `HandlerError`. Your subscription stays alive — one failed message does not kill the subscription.

### Reconnection on Stream Errors

When a gRPC stream breaks, the SDK:

1. Invokes `onError` with a `StreamBrokenError`
2. Attempts automatic reconnection using the `ReconnectionPolicy`
3. Re-subscribes transparently once reconnected
4. `StreamBrokenError.unacknowledgedMessageIds` lists any messages that may need reprocessing

## Streaming Error Recovery

### How Stream Breaks Are Detected

The SDK monitors gRPC streams for:

- Server-initiated stream closure (graceful shutdown)
- Network interruption (TCP reset, timeout)
- gRPC `UNAVAILABLE` / `INTERNAL` status codes

### Automatic Stream Reconnection

The reconnection manager uses exponential backoff with jitter (defaults: unlimited attempts, 500ms initial delay, 30s max delay). Configure via `ClientOptions.reconnect`:

```typescript
const client = await KubeMQClient.create({
  address: 'localhost:50000',
  reconnect: {
    maxAttempts: 10,
    initialDelayMs: 1000,
    maxDelayMs: 60_000,
    multiplier: 2.0,
    jitter: 'full',
  },
});
```

### Recovery with `StreamBrokenError`

For queue consumers, `StreamBrokenError` exposes `unacknowledgedMessageIds` so you can track which messages may need re-processing after the stream recovers:

```typescript
client.subscribeToEvents({
  channel: 'orders',
  onMessage: (event) => {
    /* process */
  },
  onError: (err) => {
    if (err instanceof StreamBrokenError) {
      console.warn('Unacked messages:', err.unacknowledgedMessageIds);
    }
  },
});
```

## Timeouts

### Default Timeouts

| Operation                            | Default   | Constant                           |
| ------------------------------------ | --------- | ---------------------------------- |
| Send (publish event, send queue msg) | 5 000 ms  | `DEFAULT_SEND_TIMEOUT_MS`          |
| Subscribe                            | 10 000 ms | `DEFAULT_SUBSCRIBE_TIMEOUT_MS`     |
| RPC (commands, queries)              | 10 000 ms | `DEFAULT_RPC_TIMEOUT_MS`           |
| Queue receive                        | 10 000 ms | `DEFAULT_QUEUE_RECEIVE_TIMEOUT_MS` |
| Queue poll                           | 30 000 ms | `DEFAULT_QUEUE_POLL_TIMEOUT_MS`    |
| Connection establishment             | 10 000 ms | `DEFAULT_CONNECTION_TIMEOUT_MS`    |

### Per-Operation Timeout

Override the default timeout for a specific operation using `OperationOptions`:

```typescript
await client.publishEvent(msg, { timeout: 2000 });
```

### AbortSignal Cancellation

Cancel any operation with an `AbortSignal`:

```typescript
const controller = new AbortController();
setTimeout(() => controller.abort(), 3000);

try {
  await client.sendCommand(cmd, { signal: controller.signal });
} catch (err) {
  if (err instanceof CancellationError) {
    console.log('Operation was cancelled');
  }
}
```

## Best Practices

1. **Always handle errors** — never leave promises unhandled. Use `.catch()` or `try/catch` for every async SDK call.

2. **Use `isRetryable` to decide between retry and escalation** — the SDK already retries transient errors per your `RetryPolicy`. If a `RetryExhaustedError` reaches your code, all automatic retries have been exhausted.

3. **Log `requestId` for support correlation** — every `KubeMQError` includes a `requestId` UUID. Include it in your logs and support tickets.

4. **Set appropriate timeouts** — the defaults are conservative. Tune them based on your latency requirements and message sizes.

5. **Always provide `onError` on subscriptions** — this is mandatory in v3. Swallowing subscription errors silently was a common v2 bug source.

6. **Clean up with `client.close()`** — always call `await client.close()` in a `finally` block or use `await using` to ensure graceful shutdown.

## Related Resources

- [README — Error Handling section](https://github.com/kubemq-io/kubemq-js#error-handling)
- [Troubleshooting Guide](https://github.com/kubemq-io/kubemq-js/blob/main/docs/TROUBLESHOOTING.md)
- [Migration Guide v2 → v3](https://github.com/kubemq-io/kubemq-js/blob/main/docs/MIGRATION-v3.md)
- [API Reference](https://github.com/kubemq-io/kubemq-js/blob/main/docs/api/)
