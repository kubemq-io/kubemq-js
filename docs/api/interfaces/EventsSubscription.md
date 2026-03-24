[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / EventsSubscription

# Interface: EventsSubscription

Defined in: messages/events.ts:53

Subscription request for events.

## Remarks

**Async safety:** Subscription callbacks fire sequentially on the Node.js
event loop by default. Opt-in concurrent processing is available via
`maxConcurrentCallbacks` in `SubscriptionOptions`. When concurrency > 1,
message ordering is NOT guaranteed.

## Properties

### channel

> `readonly` **channel**: `string`

Defined in: messages/events.ts:54

---

### group?

> `readonly` `optional` **group**: `string`

Defined in: messages/events.ts:55

---

### onEvent()

> `readonly` **onEvent**: (`event`) => `void`

Defined in: messages/events.ts:56

#### Parameters

##### event

[`EventReceived`](ReceivedEvent.md)

#### Returns

`void`

---

### onError()

> `readonly` **onError**: (`err`) => `void`

Defined in: messages/events.ts:57

#### Parameters

##### err

[`KubeMQError`](../classes/KubeMQError.md)

#### Returns

`void`
