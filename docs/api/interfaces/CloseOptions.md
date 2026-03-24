[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / CloseOptions

# Interface: CloseOptions

Defined in: options.ts:120

Options for the `close()` method.

## Properties

### timeoutSeconds?

> `optional` **timeoutSeconds**: `number`

Defined in: options.ts:125

Max time to wait for in-flight gRPC operations to drain, in seconds.
Default: 5.

---

### callbackTimeoutSeconds?

> `optional` **callbackTimeoutSeconds**: `number`

Defined in: options.ts:135

Max time to wait for in-flight subscription callbacks to complete, in seconds.
Default: 30.

Callbacks that haven't completed within this timeout are abandoned —
they may still be running in the background but the client will
proceed to close.
