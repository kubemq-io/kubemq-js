[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / EventStoreStreamHandle

# Interface: EventStoreStreamHandle

Defined in: messages/events-store.ts:70

## Properties

### isActive

> `readonly` **isActive**: `boolean`

Defined in: messages/events-store.ts:74

## Methods

### send()

> **send**(`msg`): `Promise`\<`void`\>

Defined in: messages/events-store.ts:71

#### Parameters

##### msg

[`EventStoreMessage`](EventStoreMessage.md)

#### Returns

`Promise`\<`void`\>

---

### onError()

> **onError**(`handler`): `void`

Defined in: messages/events-store.ts:72

#### Parameters

##### handler

(`err`) => `void`

#### Returns

`void`

---

### close()

> **close**(): `void`

Defined in: messages/events-store.ts:73

#### Returns

`void`
