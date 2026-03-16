[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / EventStoreSubscription

# Interface: EventStoreSubscription

Defined in: messages/events-store.ts:61

Subscription request for persistent events.

## Remarks

**Async safety:** Subscription callbacks fire sequentially on the Node.js
event loop by default. Opt-in concurrent processing is available via
`maxConcurrentCallbacks` in `SubscriptionOptions`. When concurrency > 1,
message ordering is NOT guaranteed.

## Properties

### channel

> `readonly` **channel**: `string`

Defined in: messages/events-store.ts:62

---

### group?

> `readonly` `optional` **group**: `string`

Defined in: messages/events-store.ts:63

---

### startFrom

> `readonly` **startFrom**: [`EventStoreType`](../enumerations/EventStoreType.md)

Defined in: messages/events-store.ts:64

---

### startValue?

> `readonly` `optional` **startValue**: `number`

Defined in: messages/events-store.ts:65

---

### onMessage()

> `readonly` **onMessage**: (`event`) => `void`

Defined in: messages/events-store.ts:66

#### Parameters

##### event

[`ReceivedEventStore`](ReceivedEventStore.md)

#### Returns

`void`

---

### onError()

> `readonly` **onError**: (`err`) => `void`

Defined in: messages/events-store.ts:67

#### Parameters

##### err

[`KubeMQError`](../classes/KubeMQError.md)

#### Returns

`void`
