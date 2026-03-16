[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / Subscription

# Interface: Subscription

Defined in: messages/subscription.ts:9

Handle for an active subscription.

## Remarks

**Async safety:** Safe to call `cancel()` from any async context, including
from within a subscription callback. Cancellation is idempotent — calling
`cancel()` multiple times is safe and has no additional effect.

## Properties

### isActive

> `readonly` **isActive**: `boolean`

Defined in: messages/subscription.ts:11

## Methods

### cancel()

> **cancel**(): `void`

Defined in: messages/subscription.ts:10

#### Returns

`void`
