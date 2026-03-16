[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / QueueBatch

# Interface: QueueBatch

Defined in: messages/queues.ts:151

## Properties

### messages

> `readonly` **messages**: [`QueueStreamMessage`](QueueStreamMessage.md)[]

Defined in: messages/queues.ts:152

---

### transactionId

> `readonly` **transactionId**: `string`

Defined in: messages/queues.ts:153

## Methods

### ackAll()

> **ackAll**(): `void`

Defined in: messages/queues.ts:154

#### Returns

`void`

---

### nackAll()

> **nackAll**(): `void`

Defined in: messages/queues.ts:155

#### Returns

`void`

---

### reQueueAll()

> **reQueueAll**(`channel`): `void`

Defined in: messages/queues.ts:156

#### Parameters

##### channel

`string`

#### Returns

`void`
