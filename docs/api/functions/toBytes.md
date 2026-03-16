[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / toBytes

# Function: toBytes()

> **toBytes**(`input`): `Uint8Array`

Defined in: internal/utils/encoding.ts:31

Normalize input to `Uint8Array`. Zero-copy when input is already
`Uint8Array`; encodes via cached TextEncoder when input is a string.

## Parameters

### input

`string` | `Uint8Array`\<`ArrayBufferLike`\>

## Returns

`Uint8Array`
