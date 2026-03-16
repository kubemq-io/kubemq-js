[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / StaticTokenProvider

# Class: StaticTokenProvider

Defined in: auth/credential-provider.ts:20

Pluggable credential provider interface for authentication.

Implementations must be safe for concurrent invocation from
the event loop (the SDK serializes calls, but user code may not).

The SDK caches the returned token and re-invokes the provider only when:

- No cached token exists
- The cached token is invalidated by a server UNAUTHENTICATED response
- Proactive refresh determines the token is approaching expiry

At most one outstanding getToken() call is in flight at any time.

## Implements

- [`CredentialProvider`](../interfaces/CredentialProvider.md)

## Constructors

### Constructor

> **new StaticTokenProvider**(`token`): `StaticTokenProvider`

Defined in: auth/credential-provider.ts:23

#### Parameters

##### token

`string`

#### Returns

`StaticTokenProvider`

## Methods

### getToken()

> **getToken**(): `Promise`\<\{ `token`: `string`; `expiresAt?`: `Date`; \}\>

Defined in: auth/credential-provider.ts:36

#### Returns

`Promise`\<\{ `token`: `string`; `expiresAt?`: `Date`; \}\>

#### Implementation of

[`CredentialProvider`](../interfaces/CredentialProvider.md).[`getToken`](../interfaces/CredentialProvider.md#gettoken)

---

### toString()

> **toString**(): `string`

Defined in: auth/credential-provider.ts:40

Returns a string representation of an object.

#### Returns

`string`

---

### toJSON()

> **toJSON**(): `Record`\<`string`, `unknown`\>

Defined in: auth/credential-provider.ts:44

#### Returns

`Record`\<`string`, `unknown`\>
