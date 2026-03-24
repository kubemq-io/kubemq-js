# How To: Handle Errors and Retries

Understand the error hierarchy, check retryability, and configure automatic retry policies.

## Error Hierarchy

All SDK errors extend `KubeMQError`. Key subtypes:

| Error Class           | Retryable | When                                    |
| --------------------- | --------- | --------------------------------------- |
| `ConnectionError`     | Yes       | Network failure, server unreachable     |
| `TransientError`      | Yes       | Temporary server-side issue             |
| `KubeMQTimeoutError`  | Yes       | Operation exceeded deadline             |
| `RetryExhaustedError` | No        | All retry attempts failed               |
| `AuthenticationError` | No        | Invalid/expired token                   |
| `ValidationError`     | No        | Bad input (empty channel, missing body) |
| `ConfigurationError`  | No        | Invalid client options                  |
| `ClientClosedError`   | No        | Client already closed                   |
| `CancellationError`   | No        | Operation cancelled via AbortSignal     |

## Catching and Inspecting Errors

```typescript
import {
  KubeMQClient,
  KubeMQError,
  ConnectionError,
  KubeMQTimeoutError,
  ValidationError,
  createEventMessage,
} from 'kubemq-js';

const client = await KubeMQClient.create({ address: 'localhost:50000' });

try {
  await client.sendEvent(createEventMessage({ channel: 'demo.errors', body: 'hello' }));
} catch (err) {
  if (err instanceof ValidationError) {
    console.error('Invalid input:', err.message);
    console.error('Suggestion:', err.suggestion);
  } else if (err instanceof KubeMQTimeoutError) {
    console.error('Timeout — retryable:', err.isRetryable);
  } else if (err instanceof ConnectionError) {
    console.error('Connection lost:', err.message);
  } else if (err instanceof KubeMQError) {
    console.error(`KubeMQ error [${err.code}]: ${err.message}`);
    console.error('Operation:', err.operation);
    console.error('Channel:', err.channel);
    console.error('Retryable:', err.isRetryable);
  }
} finally {
  await client.close();
}
```

## Built-in Retry Policy

The SDK retries transient failures automatically using exponential backoff with jitter:

```typescript
import { KubeMQClient, createEventMessage } from 'kubemq-js';

const client = await KubeMQClient.create({
  address: 'localhost:50000',
  retry: {
    maxRetries: 5,
    initialBackoffMs: 500,
    maxBackoffMs: 30_000,
    multiplier: 2.0,
    jitter: 'full',
  },
});

// All operations automatically retry on transient failures
await client.sendEvent(createEventMessage({ channel: 'demo.retry', body: 'auto-retried' }));

await client.close();
```

## Per-Operation Timeout and Cancellation

```typescript
import { KubeMQClient, createEventMessage } from 'kubemq-js';

const client = await KubeMQClient.create({ address: 'localhost:50000' });

// Timeout override for a single operation
await client.sendEvent(createEventMessage({ channel: 'demo', body: 'fast' }), { timeout: 2000 });

// Cancellation via AbortSignal
const controller = new AbortController();
setTimeout(() => controller.abort(), 3000);

try {
  await client.sendQueueMessage(
    { channel: 'queues.work', body: new TextEncoder().encode('job') },
    { signal: controller.signal },
  );
} catch (err) {
  console.error('Cancelled or timed out:', (err as Error).message);
}

await client.close();
```

## Auto-Reconnection

Configure reconnection behavior for dropped connections:

```typescript
import { KubeMQClient, ConnectionState } from 'kubemq-js';

const client = await KubeMQClient.create({
  address: 'localhost:50000',
  reconnect: {
    maxAttempts: -1, // unlimited
    initialDelayMs: 500,
    maxDelayMs: 30_000,
    multiplier: 2.0,
    jitter: 'full',
  },
});

client.on('connected', () => console.log('Connected'));
client.on('disconnected', () => console.log('Disconnected'));
client.on('reconnecting', (attempt: number) => console.log(`Reconnecting (attempt ${attempt})...`));
client.on('reconnected', () => console.log('Reconnected'));

// Subscriptions auto-resubscribe after reconnection
client.subscribeToEvents({
  channel: 'orders.created',
  onEvent: (event) => console.log('Event:', event.id),
  onError: (err) => console.error('Sub error:', err.message),
});
```

## Manual Retry Logic

For custom retry behavior beyond the built-in policy:

```typescript
import { KubeMQClient, KubeMQError, createEventMessage } from 'kubemq-js';

const client = await KubeMQClient.create({
  address: 'localhost:50000',
  retry: {
    maxRetries: 0,
    initialBackoffMs: 500,
    maxBackoffMs: 30000,
    multiplier: 2,
    jitter: 'none',
  },
});

const msg = createEventMessage({ channel: 'demo.critical', body: 'important' });

for (let attempt = 0; attempt < 3; attempt++) {
  try {
    await client.sendEvent(msg);
    console.log(`Sent on attempt ${attempt + 1}`);
    break;
  } catch (err) {
    const isRetryable = err instanceof KubeMQError && err.isRetryable;
    if (!isRetryable || attempt === 2) throw err;
    const delay = 500 * Math.pow(2, attempt);
    console.log(`Retrying in ${delay}ms...`);
    await new Promise((r) => setTimeout(r, delay));
  }
}

await client.close();
```

## Troubleshooting

| Symptom                             | Cause                              | Fix                                                |
| ----------------------------------- | ---------------------------------- | -------------------------------------------------- |
| `ClientClosedError`                 | Using client after `close()`       | Create a new client instance                       |
| `RetryExhaustedError`               | All retry attempts failed          | Increase `maxRetries` or fix the underlying issue  |
| `CancellationError`                 | AbortSignal triggered              | Expected if using timeouts or manual cancellation  |
| Subscription silently stops         | Stream broke, no `onError` handler | Always provide `onError` callback in subscriptions |
| Operations hang during reconnection | `waitForReady` not set             | Set `waitForReady: true` (default)                 |
