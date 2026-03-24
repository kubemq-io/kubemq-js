[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / createCommand

# Function: createCommand()

> **createCommand**(`opts`): `Readonly`\<[`CommandMessage`](../interfaces/CommandMessage.md)\>

Defined in: messages/commands.ts:85

Create a validated, frozen CommandMessage with defaults applied.

- `id` defaults to a random UUID
- `metadata` defaults to `''`
- `tags` defaults to `{}`
- `timeoutInSeconds` is required and must be positive
- Requires at least one of: body, metadata, or tags
- String/Buffer body is normalized to `Uint8Array`

## Parameters

### opts

`Omit`\<[`CommandMessage`](../interfaces/CommandMessage.md), `"id"`\> & `object`

## Returns

`Readonly`\<[`CommandMessage`](../interfaces/CommandMessage.md)\>
