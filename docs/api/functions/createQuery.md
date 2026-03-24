[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / createQuery

# Function: createQuery()

> **createQuery**(`opts`): `Readonly`\<[`QueryMessage`](../interfaces/QueryMessage.md)\>

Defined in: messages/queries.ts:88

Create a validated, frozen QueryMessage with defaults applied.

- `id` defaults to a random UUID
- `metadata` defaults to `''`
- `tags` defaults to `{}`
- `timeoutInSeconds` is required and must be positive
- Requires at least one of: body, metadata, or tags
- String/Buffer body is normalized to `Uint8Array`

## Parameters

### opts

`Omit`\<[`QueryMessage`](../interfaces/QueryMessage.md), `"id"`\> & `object`

## Returns

`Readonly`\<[`QueryMessage`](../interfaces/QueryMessage.md)\>
