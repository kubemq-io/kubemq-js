[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / CommandSubscription

# Interface: CommandSubscription

Defined in: messages/commands.ts:68

Subscription request for RPC commands.

## Remarks

**Async safety:** Subscription callbacks fire sequentially on the Node.js
event loop by default. Opt-in concurrent processing is available via
`maxConcurrentCallbacks` in `SubscriptionOptions`. When concurrency > 1,
message ordering is NOT guaranteed.

## Properties

### channel

> `readonly` **channel**: `string`

Defined in: messages/commands.ts:69

---

### group?

> `readonly` `optional` **group**: `string`

Defined in: messages/commands.ts:70

---

### onCommand()

> `readonly` **onCommand**: (`cmd`) => `void`

Defined in: messages/commands.ts:71

#### Parameters

##### cmd

[`ReceivedCommand`](ReceivedCommand.md)

#### Returns

`void`

---

### onError()

> `readonly` **onError**: (`err`) => `void`

Defined in: messages/commands.ts:72

#### Parameters

##### err

[`KubeMQError`](../classes/KubeMQError.md)

#### Returns

`void`
