[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / createEventStoreMessage

# Function: createEventStoreMessage()

> **createEventStoreMessage**(`opts`): `Readonly`\<[`EventStoreMessage`](../interfaces/EventStoreMessage.md)\>

Defined in: messages/events-store.ts:85

Create a validated, frozen EventStoreMessage with defaults applied.

- `id` defaults to a random UUID
- `metadata` defaults to `''`
- `tags` defaults to `{}`
- String/Buffer body is normalized to `Uint8Array`

## Parameters

### opts

`Omit`\<[`EventStoreMessage`](../interfaces/EventStoreMessage.md), `"id"`\> & `object`

## Returns

`Readonly`\<[`EventStoreMessage`](../interfaces/EventStoreMessage.md)\>
