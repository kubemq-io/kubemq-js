[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / createEventMessage

# Function: createEventMessage()

> **createEventMessage**(`opts`): `Readonly`\<[`EventMessage`](../interfaces/EventMessage.md)\>

Defined in: messages/events.ts:75

Create a validated, frozen EventMessage with defaults applied.

- `id` defaults to a random UUID
- `metadata` defaults to `''`
- `tags` defaults to `{}`
- String/Buffer body is normalized to `Uint8Array`

## Parameters

### opts

`Omit`\<[`EventMessage`](../interfaces/EventMessage.md), `"id"`\> & `object`

## Returns

`Readonly`\<[`EventMessage`](../interfaces/EventMessage.md)\>
