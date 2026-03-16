[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / QuerySubscription

# Interface: QuerySubscription

Defined in: messages/queries.ts:71

Subscription request for RPC queries.

## Remarks

**Async safety:** Subscription callbacks fire sequentially on the Node.js
event loop by default. Opt-in concurrent processing is available via
`maxConcurrentCallbacks` in `SubscriptionOptions`. When concurrency > 1,
message ordering is NOT guaranteed.

## Properties

### channel

> `readonly` **channel**: `string`

Defined in: messages/queries.ts:72

---

### group?

> `readonly` `optional` **group**: `string`

Defined in: messages/queries.ts:73

---

### onQuery()

> `readonly` **onQuery**: (`query`) => `void`

Defined in: messages/queries.ts:74

#### Parameters

##### query

[`ReceivedQuery`](ReceivedQuery.md)

#### Returns

`void`

---

### onError()

> `readonly` **onError**: (`err`) => `void`

Defined in: messages/queries.ts:75

#### Parameters

##### err

[`KubeMQError`](../classes/KubeMQError.md)

#### Returns

`void`
