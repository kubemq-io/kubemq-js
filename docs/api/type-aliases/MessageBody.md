[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / MessageBody

# Type Alias: MessageBody

> **MessageBody** = `string` \| `Uint8Array` \| `Buffer`

Defined in: internal/utils/body.ts:12

Union type for message body inputs. Accepts string (auto-encoded to UTF-8),
Uint8Array, or Node.js Buffer (zero-copy view extracted).

Public API methods and factory functions accept `MessageBody`;
internally the SDK normalizes to `Uint8Array` before sending to gRPC.
