[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / QueueStreamHandle

# Interface: QueueStreamHandle

Defined in: messages/queues.ts:121

## Properties

### isActive

> `readonly` **isActive**: `boolean`

Defined in: messages/queues.ts:122

---

### responseMetadata

> `readonly` **responseMetadata**: `Record`\<`string`, `string`\>

Defined in: messages/queues.ts:123

## Methods

### onMessages()

> **onMessages**(`handler`): `void`

Defined in: messages/queues.ts:124

#### Parameters

##### handler

(`messages`) => `void`

#### Returns

`void`

---

### onError()

> **onError**(`handler`): `void`

Defined in: messages/queues.ts:125

#### Parameters

##### handler

(`err`) => `void`

#### Returns

`void`

---

### onClose()

> **onClose**(`handler`): `void`

Defined in: messages/queues.ts:126

#### Parameters

##### handler

() => `void`

#### Returns

`void`

---

### close()

> **close**(): `void`

Defined in: messages/queues.ts:127

#### Returns

`void`

---

### ackAll()

> **ackAll**(): `void`

Defined in: messages/queues.ts:128

#### Returns

`void`

---

### nackAll()

> **nackAll**(): `void`

Defined in: messages/queues.ts:129

#### Returns

`void`

---

### reQueueAll()

> **reQueueAll**(`channel`): `void`

Defined in: messages/queues.ts:130

#### Parameters

##### channel

`string`

#### Returns

`void`

---

### ackRange()

> **ackRange**(`sequences`): `void`

Defined in: messages/queues.ts:131

#### Parameters

##### sequences

`number`[]

#### Returns

`void`

---

### nackRange()

> **nackRange**(`sequences`): `void`

Defined in: messages/queues.ts:132

#### Parameters

##### sequences

`number`[]

#### Returns

`void`

---

### reQueueRange()

> **reQueueRange**(`channel`, `sequences`): `void`

Defined in: messages/queues.ts:133

#### Parameters

##### channel

`string`

##### sequences

`number`[]

#### Returns

`void`

---

### getActiveOffsets()

> **getActiveOffsets**(): `Promise`\<`number`[]\>

Defined in: messages/queues.ts:134

#### Returns

`Promise`\<`number`[]\>

---

### getTransactionStatus()

> **getTransactionStatus**(): `Promise`\<`boolean`\>

Defined in: messages/queues.ts:135

#### Returns

`Promise`\<`boolean`\>
