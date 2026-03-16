# Troubleshooting Guide

This guide covers the most common issues you may encounter when using the KubeMQ JS/TS SDK v3, with exact error messages and step-by-step solutions.

## Problem: Connection Refused / Connection Timeout

**Error message:**

```
ConnectionError: Failed to connect to "kubemq-server:50000": connection timeout after 10000ms
```

**Cause:**

The SDK cannot establish a TCP connection to the KubeMQ server within the configured timeout. The server may not be running, the address may be incorrect, or a firewall is blocking the port.

**Solution:**

1. Verify the KubeMQ server is running: `docker ps | grep kubemq` or check the process on your host.
2. Confirm the address and port match the server configuration. The default gRPC port is `50000`.
3. Test connectivity from your application host: `nc -zv <host> 50000`.
4. If the server is behind a load balancer or proxy, ensure gRPC (HTTP/2) pass-through is enabled.
5. Increase the connection timeout if the server is remote:

```typescript
const client = await KubeMQClient.create({
  address: 'remote-server:50000',
  connectionTimeoutMs: 30_000,
});
```

## Problem: Authentication Failed (Invalid Token)

**Error message:**

```
AuthenticationError: Authentication failed: invalid or expired token
```

**Cause:**

The auth token provided to the SDK is not recognized by the KubeMQ server. The token may be expired, malformed, or not matching the server's configured JWT secret.

**Solution:**

1. Verify your token is valid and has not expired.
2. Confirm the token matches the server's `--authentication-token` or JWT signing key.
3. If using a `CredentialProvider`, ensure it returns a fresh token:

```typescript
import { KubeMQClient } from 'kubemq-js';

const client = await KubeMQClient.create({
  address: 'localhost:50000',
  credentials: 'your-valid-jwt-token',
});
```

4. Check server logs for authentication rejection details.

## Problem: Authorization Denied (Insufficient Permissions)

**Error message:**

```
AuthorizationError: Permission denied for operation "publishEvent" on channel "restricted.channel"
```

**Cause:**

The authenticated identity does not have permission to perform the requested operation on the specified channel. The server's access control policy is rejecting the request.

**Solution:**

1. Verify your user/token has the required permissions for the channel and operation.
2. Check the KubeMQ server's authorization configuration.
3. If using KubeMQ Dashboard, review the access control rules for your client identity.
4. Use a different channel that your credentials have access to, or request elevated permissions from your administrator.

## Problem: Channel Not Found

**Error message:**

```
NotFoundError: Channel "nonexistent.channel" not found
```

**Cause:**

The specified channel does not exist on the KubeMQ server. KubeMQ creates channels on-demand for pub/sub patterns, but queue channels may need to be created explicitly depending on server configuration.

**Solution:**

1. Verify the channel name is spelled correctly (channel names are case-sensitive).
2. Ensure the channel has been created or that at least one subscriber is active on it.
3. Create the channel programmatically if needed:

```typescript
await client.createChannel('queues', 'my-queue-channel');
```

4. Check the KubeMQ Dashboard or use `listChannels()` to see available channels.

## Problem: Message Too Large

**Error message:**

```
ValidationError: Message body exceeds maximum size of 104857600 bytes
```

**Cause:**

The message body exceeds the configured maximum message size. The default limit is 100 MB (104,857,600 bytes), matching the KubeMQ server default.

**Solution:**

1. Reduce the message body size by compressing the payload or splitting it into smaller chunks.
2. If the server has been configured with a higher limit, increase the client-side limit:

```typescript
const client = await KubeMQClient.create({
  address: 'localhost:50000',
  maxSendMessageSize: 200 * 1024 * 1024, // 200 MB
});
```

3. For large data transfers, consider streaming the data or storing it externally and sending a reference.

## Problem: Timeout / Deadline Exceeded

**Error message:**

```
KubeMQTimeoutError: Operation "sendCommand" timed out after 10000ms
```

**Cause:**

The operation did not complete within its deadline. This can happen when the server is overloaded, the responder is slow, or the network has high latency.

**Solution:**

1. Increase the per-operation timeout:

```typescript
const response = await client.sendCommand(cmd, { timeout: 30_000 });
```

2. If the server is consistently slow, increase the default timeout via `ClientOptions`.
3. Check server health and resource utilization.
4. For commands/queries, ensure the responder (subscriber) is running and processing requests promptly.
5. Use `AbortSignal` for explicit cancellation control instead of relying solely on timeouts:

```typescript
const controller = new AbortController();
setTimeout(() => controller.abort(), 15_000);
await client.sendCommand(cmd, { signal: controller.signal });
```

## Problem: Rate Limiting / Throttling

**Error message:**

```
ThrottlingError: Request throttled by server (RESOURCE_EXHAUSTED)
```

**Cause:**

The KubeMQ server is rate-limiting requests because the client is sending faster than the server can process. This is a transient condition — the SDK will auto-retry with exponential backoff.

**Solution:**

1. The SDK automatically retries throttled requests using the configured `RetryPolicy`. If you still see this error, all retry attempts have been exhausted.
2. Reduce your send rate by adding delays between messages or using a queue pattern with backpressure.
3. Check if the server has rate-limiting policies configured and adjust them if appropriate.
4. Scale the KubeMQ server horizontally to handle higher throughput.

## Problem: Internal Server Error

**Error message:**

```
FatalError: Internal server error during "sendQuery"
```

**Cause:**

The KubeMQ server encountered an unrecoverable internal error. This typically indicates a server-side bug or resource exhaustion (e.g., disk full, out of memory).

**Solution:**

1. Check the KubeMQ server logs for detailed error information.
2. Verify the server has sufficient resources (CPU, memory, disk).
3. Restart the KubeMQ server if the issue persists.
4. If reproducible, open an issue on the [KubeMQ GitHub repository](https://github.com/kubemq-io/kubemq) with server logs.

## Problem: TLS Handshake Failure

**Error message:**

```
ConnectionError: TLS handshake failed: certificate verify failed
```

**Cause:**

The TLS handshake between the SDK and the KubeMQ server failed. Common causes: the CA certificate does not match the server certificate, the server certificate has expired, or the certificate files are not readable.

**Solution:**

1. Verify the CA certificate matches the server's certificate issuer.
2. Check that certificate files exist and are readable by the Node.js process.
3. Ensure the server certificate has not expired: `openssl x509 -enddate -noout -in server-cert.pem`.
4. For testing, you can skip certificate verification (not recommended for production):

```typescript
const client = await KubeMQClient.create({
  address: 'kubemq-server:50000',
  tls: {
    enabled: true,
    caCert: '/path/to/ca.pem',
    insecureSkipVerify: true, // DO NOT use in production
  },
});
```

5. For mutual TLS (mTLS), provide both client certificate and key:

```typescript
const client = await KubeMQClient.create({
  address: 'kubemq-server:50000',
  tls: {
    enabled: true,
    caCert: '/path/to/ca.pem',
    clientCert: '/path/to/client-cert.pem',
    clientKey: '/path/to/client-key.pem',
  },
});
```

## Problem: No Messages Received (Subscriber Not Getting Messages)

This is a diagnostic checklist — there may not be a specific error message.

**Cause:**

The subscriber is set up but is not receiving messages that you expect. This is typically a configuration or timing issue rather than an SDK error.

**Solution:**

1. **Verify subscriber is connected before publisher sends.** For events (fire-and-forget), the subscriber must be active when the event is published. Events published before the subscriber connects are lost.

2. **Check the channel name matches exactly.** Channel names are case-sensitive. `"orders.new"` and `"Orders.new"` are different channels.

3. **Check group name for load-balanced subscriptions.** If multiple subscribers share the same group, each message is delivered to only one member of the group:

```typescript
client.subscribeToEvents({
  channel: 'orders',
  group: 'processors', // Only one subscriber in this group receives each message
  onMessage: (event) => {
    /* ... */
  },
  onError: (err) => {
    /* ... */
  },
});
```

4. **Verify the `onError` callback is not silently receiving errors.** Add logging to `onError` to check for stream errors or connection issues:

```typescript
client.subscribeToEvents({
  channel: 'orders',
  onMessage: (event) => {
    /* ... */
  },
  onError: (err) => {
    console.error('Subscription error — this might explain missing messages:', err.message);
  },
});
```

5. **For Events Store, check the `startFrom` parameter.** If you use `StartNewOnly`, you only receive events published after the subscription starts. Use `StartFromFirst` or `StartAtSequence` to replay historical events:

```typescript
import { EventStoreType } from 'kubemq-js';

client.subscribeToEventsStore({
  channel: 'audit-log',
  startFrom: EventStoreType.StartFromFirst,
  onMessage: (event) => {
    /* ... */
  },
  onError: (err) => {
    /* ... */
  },
});
```

## Problem: Queue Message Not Acknowledged (Redelivery Behavior)

This is not an error but unexpected behavior — messages reappear after being received.

**Cause:**

When you receive a queue message with a visibility timeout, the message becomes hidden from other consumers for `visibilitySeconds`. If you don't call `msg.ack()` before the visibility timeout expires, the message becomes visible again and will be redelivered to the next consumer.

**Solution:**

1. **Always call `msg.ack()` after successful processing:**

```typescript
const messages = await client.receiveQueueMessages({
  channel: 'tasks',
  visibilitySeconds: 30,
  waitTimeoutSeconds: 5,
});

for (const msg of messages) {
  try {
    await processTask(msg);
    await msg.ack();
  } catch (err) {
    // Reject the message to send it to the dead-letter queue.
    await msg.reject();
  }
}
```

2. **Increase `visibilitySeconds`** if your processing takes longer than expected.

3. **Use `msg.reject()`** to permanently remove a message you cannot process (sends it to the dead-letter queue if configured).

4. **Use `msg.requeue('other.channel')`** to move a message to a different queue for later processing or specialized handling.

5. **Configure a dead-letter queue** with `maxReceiveCount` in the message policy to automatically move poison messages after repeated delivery failures:

```typescript
import { createQueueMessage } from 'kubemq-js';

await client.sendQueueMessage(
  createQueueMessage({
    channel: 'tasks',
    body: 'Process this',
    policy: {
      maxReceiveCount: 3,
      maxReceiveQueue: 'tasks.dead-letter',
    },
  }),
);
```

## gRPC Status Code Mapping

The SDK automatically maps gRPC status codes from the KubeMQ server into typed `KubeMQError` subclasses. This table shows the full mapping and whether each error is automatically retried.

| gRPC Code | gRPC Status          | SDK Error Class                          | Retryable | Notes                                                                 |
| --------- | -------------------- | ---------------------------------------- | --------- | --------------------------------------------------------------------- |
| 0         | `OK`                 | —                                        | —         | Success; no error raised                                              |
| 1         | `CANCELLED`          | `CancellationError` / `TransientError`   | Depends   | Local `AbortSignal` → `CancellationError`; server cancel → retried   |
| 2         | `UNKNOWN`            | `TransientError`                         | Yes       | Unknown error from server or proxy                                    |
| 3         | `INVALID_ARGUMENT`   | `ValidationError`                        | No        | Bad request parameters (empty channel, missing body, etc.)            |
| 4         | `DEADLINE_EXCEEDED`  | `KubeMQTimeoutError`                     | Yes       | Operation timed out                                                   |
| 5         | `NOT_FOUND`          | `NotFoundError`                          | No        | Channel or resource does not exist                                    |
| 6         | `ALREADY_EXISTS`     | `ValidationError`                        | No        | Resource already exists                                               |
| 7         | `PERMISSION_DENIED`  | `AuthorizationError`                     | No        | Insufficient permissions for the operation                            |
| 8         | `RESOURCE_EXHAUSTED` | `ThrottlingError`                        | Yes       | Server rate-limiting; SDK retries with backoff                        |
| 9         | `FAILED_PRECONDITION`| `ValidationError`                        | No        | State precondition not met                                            |
| 10        | `ABORTED`            | `TransientError`                         | Yes       | Transaction conflict; SDK retries                                     |
| 11        | `OUT_OF_RANGE`       | `ValidationError`                        | No        | Iterator or pagination boundary exceeded                              |
| 12        | `UNIMPLEMENTED`      | `FatalError`                             | No        | Feature not supported by the server version                           |
| 13        | `INTERNAL`           | `KubeMQTimeoutError` / `FatalError`      | Depends   | Message contains "timeout" → timeout error (retried); otherwise fatal |
| 14        | `UNAVAILABLE`        | `ConnectionError`                        | Yes       | Server temporarily unavailable; SDK retries with reconnection         |
| 15        | `DATA_LOSS`          | `FatalError`                             | No        | Unrecoverable data loss                                               |
| 16        | `UNAUTHENTICATED`    | `AuthenticationError`                    | No        | Invalid or expired credentials                                        |

**How to use this table:** When you catch a `KubeMQError`, check its `code` and `isRetryable` properties. Retryable errors are handled automatically by the SDK's retry policy — you only see them when all retry attempts have been exhausted.

```typescript
import { KubeMQError, ConnectionError, ThrottlingError } from 'kubemq-js';

try {
  await client.publishEvent(msg);
} catch (err) {
  if (err instanceof KubeMQError) {
    console.log('Error code:', err.code);
    console.log('Retryable:', err.isRetryable);
    console.log('Suggestion:', err.suggestion);
  }
}
```

## How to Enable Debug Logging

By default, the SDK uses a no-op logger that produces zero output. To see internal SDK activity (connection lifecycle, retries, message flow), enable the built-in console logger at `debug` level.

### Enabling Debug Logging

```typescript
import { KubeMQClient, createConsoleLogger } from 'kubemq-js';

const client = await KubeMQClient.create({
  address: 'localhost:50000',
  logger: createConsoleLogger('debug'),
});
```

The `createConsoleLogger` function accepts one of the following log levels (from most to least verbose):

| Level   | Output                          |
| ------- | ------------------------------- |
| `debug` | All messages (most verbose)     |
| `info`  | Info, warnings, and errors      |
| `warn`  | Warnings and errors only        |
| `error` | Errors only                     |
| `off`   | No output (same as default)     |

### What Debug Output Looks Like

With `debug` level enabled, you will see structured log lines in the console:

```
[DEBUG] Connecting to KubeMQ server { address: 'localhost:50000' }
[DEBUG] gRPC channel state changed { state: 'READY' }
[INFO]  Connection established { address: 'localhost:50000', clientId: 'abc-123' }
[DEBUG] Publishing event { channel: 'events.hello', bodySize: 12 }
[DEBUG] Subscribe stream opened { channel: 'events.hello', type: 'events' }
[WARN]  Connection lost, reconnecting { attempt: 1, backoffMs: 500 }
[DEBUG] Reconnection succeeded { attempt: 1 }
```

Log entries include structured key-value fields (printed as a JSON-like object after the message) that provide context for each operation.

### Using a Custom Logger

You can pass any logger that implements the `Logger` interface (compatible with pino, winston, bunyan, and similar libraries):

```typescript
import { KubeMQClient, type Logger } from 'kubemq-js';
import pino from 'pino';

const pinoLogger = pino({ level: 'debug' });

const logger: Logger = {
  debug: (msg, fields) => pinoLogger.debug(fields, msg),
  info:  (msg, fields) => pinoLogger.info(fields, msg),
  warn:  (msg, fields) => pinoLogger.warn(fields, msg),
  error: (msg, fields) => pinoLogger.error(fields, msg),
};

const client = await KubeMQClient.create({
  address: 'localhost:50000',
  logger,
});
```

## Related Resources

- [Error Handling Guide](https://github.com/kubemq-io/kubemq-js/blob/main/docs/ERROR-HANDLING.md) — full error hierarchy and retry behavior
- [README — Troubleshooting section](https://github.com/kubemq-io/kubemq-js#troubleshooting)
- [Migration Guide v2 → v3](https://github.com/kubemq-io/kubemq-js/blob/main/docs/MIGRATION-v3.md) — if you are upgrading from v2
- [Examples](https://github.com/kubemq-io/kubemq-js/tree/main/examples) — working code for all messaging patterns
