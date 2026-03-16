[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / QueueUpstreamHandle

# Interface: QueueUpstreamHandle

Defined in: messages/queues.ts:145

## Properties

### isActive

> `readonly` **isActive**: `boolean`

Defined in: messages/queues.ts:148

## Methods

### send()

> **send**(`msgs`): `Promise`\<[`QueueUpstreamResult`](QueueUpstreamResult.md)\>

Defined in: messages/queues.ts:146

#### Parameters

##### msgs

[`QueueMessage`](QueueMessage.md)[]

#### Returns

`Promise`\<[`QueueUpstreamResult`](QueueUpstreamResult.md)\>

---

### close()

> **close**(): `void`

Defined in: messages/queues.ts:147

#### Returns

`void`
