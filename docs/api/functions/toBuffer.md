[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / toBuffer

# Function: toBuffer()

> **toBuffer**(`data`): `Buffer`

Defined in: internal/utils/encoding.ts:46

Create a zero-copy `Buffer` view over a `Uint8Array`.
Use when gRPC or protobuf APIs require `Buffer`.

## Parameters

### data

`Uint8Array`

## Returns

`Buffer`

## Remarks

`Buffer.from(uint8.buffer, uint8.byteOffset, uint8.byteLength)` shares
the underlying ArrayBuffer — no data copy.
