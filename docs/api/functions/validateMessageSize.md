[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / validateMessageSize

# Function: validateMessageSize()

> **validateMessageSize**(`body`, `maxSendMessageSize`, `operation`, `channel?`): `void`

Defined in: internal/validation/message-size.ts:20

Validate that the message body does not exceed the configured maximum
send size. Throws `ValidationError` with an actionable suggestion.

## Parameters

### body

`Uint8Array`

The serialized message body

### maxSendMessageSize

`number`

Maximum allowed body size in bytes

### operation

`string`

The SDK operation name (for error context)

### channel?

`string`

The target channel name (for error context)

## Returns

`void`
