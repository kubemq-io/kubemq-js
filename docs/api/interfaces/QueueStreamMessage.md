[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / QueueStreamMessage

# Interface: QueueStreamMessage

Defined in: messages/queues.ts:101

## Properties

### id

> `readonly` **id**: `string`

Defined in: messages/queues.ts:102

---

### channel

> `readonly` **channel**: `string`

Defined in: messages/queues.ts:103

---

### body

> `readonly` **body**: `Uint8Array`

Defined in: messages/queues.ts:104

---

### metadata

> `readonly` **metadata**: `string`

Defined in: messages/queues.ts:105

---

### tags

> `readonly` **tags**: `Record`\<`string`, `string`\>

Defined in: messages/queues.ts:106

---

### timestamp

> `readonly` **timestamp**: `Date`

Defined in: messages/queues.ts:107

---

### sequence

> `readonly` **sequence**: `number`

Defined in: messages/queues.ts:108

---

### receiveCount

> `readonly` **receiveCount**: `number`

Defined in: messages/queues.ts:109

---

### md5OfBody?

> `readonly` `optional` **md5OfBody**: `string`

Defined in: messages/queues.ts:110

---

### isReRouted

> `readonly` **isReRouted**: `boolean`

Defined in: messages/queues.ts:111

---

### reRouteFromQueue?

> `readonly` `optional` **reRouteFromQueue**: `string`

Defined in: messages/queues.ts:112

---

### expiredAt?

> `readonly` `optional` **expiredAt**: `Date`

Defined in: messages/queues.ts:113

---

### delayedTo?

> `readonly` `optional` **delayedTo**: `Date`

Defined in: messages/queues.ts:114

## Methods

### ack()

> **ack**(): `void`

Defined in: messages/queues.ts:116

#### Returns

`void`

---

### reject()

> **reject**(): `void`

Defined in: messages/queues.ts:117

#### Returns

`void`

---

### reQueue()

> **reQueue**(`channel`): `void`

Defined in: messages/queues.ts:118

#### Parameters

##### channel

`string`

#### Returns

`void`
