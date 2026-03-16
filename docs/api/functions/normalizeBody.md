[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / normalizeBody

# Function: normalizeBody()

> **normalizeBody**(`body`): `Uint8Array`

Defined in: internal/utils/body.ts:21

Normalize any accepted body input to a `Uint8Array`.

- `string` → UTF-8 encoded via cached `TextEncoder`
- `Buffer` → zero-copy `Uint8Array` view (no data copy)
- `Uint8Array` → returned as-is

## Parameters

### body

[`MessageBody`](../type-aliases/MessageBody.md)

## Returns

`Uint8Array`
