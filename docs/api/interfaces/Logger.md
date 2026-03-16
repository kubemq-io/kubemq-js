[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / Logger

# Interface: Logger

Defined in: logger.ts:7

Structured logging interface. Users inject their preferred logger
(pino, winston, bunyan, etc.) via ClientOptions.

Default: noopLogger — zero output unless configured.

## Methods

### debug()

> **debug**(`msg`, `fields?`): `void`

Defined in: logger.ts:8

#### Parameters

##### msg

`string`

##### fields?

`Record`\<`string`, `unknown`\>

#### Returns

`void`

---

### info()

> **info**(`msg`, `fields?`): `void`

Defined in: logger.ts:9

#### Parameters

##### msg

`string`

##### fields?

`Record`\<`string`, `unknown`\>

#### Returns

`void`

---

### warn()

> **warn**(`msg`, `fields?`): `void`

Defined in: logger.ts:10

#### Parameters

##### msg

`string`

##### fields?

`Record`\<`string`, `unknown`\>

#### Returns

`void`

---

### error()

> **error**(`msg`, `fields?`): `void`

Defined in: logger.ts:11

#### Parameters

##### msg

`string`

##### fields?

`Record`\<`string`, `unknown`\>

#### Returns

`void`
