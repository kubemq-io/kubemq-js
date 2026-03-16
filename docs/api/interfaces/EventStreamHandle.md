[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / EventStreamHandle

# Interface: EventStreamHandle

Defined in: messages/events.ts:60

## Properties

### isActive

> `readonly` **isActive**: `boolean`

Defined in: messages/events.ts:64

## Methods

### send()

> **send**(`msg`): `void`

Defined in: messages/events.ts:61

#### Parameters

##### msg

[`EventMessage`](EventMessage.md)

#### Returns

`void`

---

### onError()

> **onError**(`handler`): `void`

Defined in: messages/events.ts:62

#### Parameters

##### handler

(`err`) => `void`

#### Returns

`void`

---

### close()

> **close**(): `void`

Defined in: messages/events.ts:63

#### Returns

`void`
