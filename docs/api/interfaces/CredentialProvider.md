[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / CredentialProvider

# Interface: CredentialProvider

Defined in: auth/credential-provider.ts:16

Pluggable credential provider interface for authentication.

Implementations must be safe for concurrent invocation from
the event loop (the SDK serializes calls, but user code may not).

The SDK caches the returned token and re-invokes the provider only when:

- No cached token exists
- The cached token is invalidated by a server UNAUTHENTICATED response
- Proactive refresh determines the token is approaching expiry

At most one outstanding getToken() call is in flight at any time.

## Methods

### getToken()

> **getToken**(): `Promise`\<\{ `token`: `string`; `expiresAt?`: `Date`; \}\>

Defined in: auth/credential-provider.ts:17

#### Returns

`Promise`\<\{ `token`: `string`; `expiresAt?`: `Date`; \}\>
