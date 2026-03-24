[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / ReceivedQueueMessage

# Interface: ReceivedQueueMessage

Defined in: messages/queues.ts:44

Received queue message with acknowledgment methods.

## Remarks

**Async safety:** The `ack()`, `nack()`, and `reQueue()` methods are safe
to call from any async context, but each message MUST be acknowledged exactly
once. Calling `ack()` after `nack()` (or vice versa) throws a
`ValidationError`. The visibility timer runs independently — if the message
is not acknowledged before the visibility timeout expires, it becomes
available to other consumers.

## Properties

### id

> `readonly` **id**: `string`

Defined in: messages/queues.ts:45

---

### channel

> `readonly` **channel**: `string`

Defined in: messages/queues.ts:46

---

### fromClientId

> `readonly` **fromClientId**: `string`

Defined in: messages/queues.ts:47

---

### body

> `readonly` **body**: `Uint8Array`

Defined in: messages/queues.ts:48

---

### metadata

> `readonly` **metadata**: `string`

Defined in: messages/queues.ts:49

---

### tags

> `readonly` **tags**: `Record`\<`string`, `string`\>

Defined in: messages/queues.ts:50

---

### timestamp

> `readonly` **timestamp**: `Date`

Defined in: messages/queues.ts:51

---

### sequence

> `readonly` **sequence**: `number`

Defined in: messages/queues.ts:52

---

### receiveCount

> `readonly` **receiveCount**: `number`

Defined in: messages/queues.ts:53

---

### isReRouted

> `readonly` **isReRouted**: `boolean`

Defined in: messages/queues.ts:54

---

### reRouteFromQueue?

> `readonly` `optional` **reRouteFromQueue**: `string`

Defined in: messages/queues.ts:55

---

### expiredAt?

> `readonly` `optional` **expiredAt**: `Date`

Defined in: messages/queues.ts:56

---

### delayedTo?

> `readonly` `optional` **delayedTo**: `Date`

Defined in: messages/queues.ts:57

## Methods

### ack()

> **ack**(): `Promise`\<`void`\>

Defined in: messages/queues.ts:59

#### Returns

`Promise`\<`void`\>

---

### nack()

> **nack**(): `Promise`\<`void`\>

Defined in: messages/queues.ts:60

#### Returns

`Promise`\<`void`\>

---

### reQueue()

> **reQueue**(`channel`): `Promise`\<`void`\>

Defined in: messages/queues.ts:61

#### Parameters

##### channel

`string`

#### Returns

`Promise`\<`void`\>
