[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / OperationOptions

# Interface: OperationOptions

Defined in: options.ts:78

Options for individual async operations.

## Remarks

Pass to any async method on `KubeMQClient` to control cancellation
and timeout behavior for that specific operation.

## Extended by

- [`SubscriptionOptions`](SubscriptionOptions.md)

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

---

### timeout?

> `optional` **timeout**: `number`

Defined in: options.ts:97

Operation timeout in milliseconds.
Overrides the client-level default timeout for this operation.
When exceeded, throws `KubeMQTimeoutError`.
