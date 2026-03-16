[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / CloseOptions

# Interface: CloseOptions

Defined in: options.ts:120

Options for the `close()` method.

## Properties

### timeoutMs?

> `optional` **timeoutMs**: `number`

Defined in: options.ts:125

Max time to wait for in-flight gRPC operations to drain, in ms.
Default: 5000 (5s).

---

### callbackTimeoutMs?

> `optional` **callbackTimeoutMs**: `number`

Defined in: options.ts:135

Max time to wait for in-flight subscription callbacks to complete, in ms.
Default: 30000 (30s).

Callbacks that haven't completed within this timeout are abandoned —
they may still be running in the background but the client will
proceed to close.
