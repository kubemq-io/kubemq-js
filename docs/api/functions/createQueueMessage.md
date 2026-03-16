[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / createQueueMessage

# Function: createQueueMessage()

> **createQueueMessage**(`opts`): `Readonly`\<[`QueueMessage`](../interfaces/QueueMessage.md)\>

Defined in: messages/queues.ts:168

Create a validated, frozen QueueMessage with defaults applied.

- `id` defaults to a random UUID
- `metadata` defaults to `''`
- `tags` defaults to `{}`
- Nested `policy` is also frozen
- String/Buffer body is normalized to `Uint8Array`

## Parameters

### opts

`Omit`\<[`QueueMessage`](../interfaces/QueueMessage.md), `"id"`\> & `object`

## Returns

`Readonly`\<[`QueueMessage`](../interfaces/QueueMessage.md)\>
