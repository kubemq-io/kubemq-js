[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / bytesToString

# Function: bytesToString()

> **bytesToString**(`bytes`): `string`

Defined in: internal/utils/encoding.ts:23

Decode UTF-8 bytes to a string using the cached TextDecoder.
Throws `TypeError` on invalid UTF-8 sequences (fail-fast).

## Parameters

### bytes

`Uint8Array`

## Returns

`string`
