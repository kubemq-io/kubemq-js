[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / SubscriptionOptions

# Interface: SubscriptionOptions

Defined in: options.ts:103

Options for subscription operations, extending OperationOptions.

## Extends

- [`OperationOptions`](OperationOptions.md)

## Properties

### signal?

> `optional` **signal**: `AbortSignal`

Defined in: options.ts:90

AbortSignal for cooperative cancellation.
When aborted, the operation is cancelled and throws `CancellationError`.

#### Example

```typescript
const controller = new AbortController();
setTimeout(() => controller.abort(), 5000);
await client.publishEvent(msg, { signal: controller.signal });
```

#### Inherited from

[`OperationOptions`](OperationOptions.md).[`signal`](OperationOptions.md#signal)

---

### timeout?

> `optional` **timeout**: `number`

Defined in: options.ts:97

Operation timeout in milliseconds.
Overrides the client-level default timeout for this operation.
When exceeded, throws `KubeMQTimeoutError`.

#### Inherited from

[`OperationOptions`](OperationOptions.md).[`timeout`](OperationOptions.md#timeout)

---

### maxConcurrentCallbacks?

> `optional` **maxConcurrentCallbacks**: `number`

Defined in: options.ts:114

Maximum number of concurrent callback invocations.
Default: 1 (sequential processing — callbacks never overlap).
Set to a higher value for parallel message processing.

#### Remarks

When > 1, messages are dispatched to the callback concurrently
using an internal semaphore. Message ordering is NOT guaranteed
when concurrency > 1. Use 1 (default) for ordered processing.
