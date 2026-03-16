[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / KubeMQError

# Class: KubeMQError

Defined in: errors.ts:83

## Extends

- `Error`

## Extended by

- [`ConnectionError`](ConnectionError.md)
- [`AuthenticationError`](AuthenticationError.md)
- [`AuthorizationError`](AuthorizationError.md)
- [`KubeMQTimeoutError`](KubeMQTimeoutError.md)
- [`ValidationError`](ValidationError.md)
- [`TransientError`](TransientError.md)
- [`ThrottlingError`](ThrottlingError.md)
- [`NotFoundError`](NotFoundError.md)
- [`FatalError`](FatalError.md)
- [`CancellationError`](CancellationError.md)
- [`BufferFullError`](BufferFullError.md)
- [`StreamBrokenError`](StreamBrokenError.md)
- [`ClientClosedError`](ClientClosedError.md)
- [`ConfigurationError`](ConfigurationError.md)
- [`RetryExhaustedError`](RetryExhaustedError.md)
- [`NotImplementedError`](NotImplementedError.md)
- [`PartialFailureError`](PartialFailureError.md)
- [`HandlerError`](HandlerError.md)

## Constructors

### Constructor

> **new KubeMQError**(`options`): `KubeMQError`

Defined in: errors.ts:113

#### Parameters

##### options

[`KubeMQErrorOptions`](../interfaces/KubeMQErrorOptions.md)

#### Returns

`KubeMQError`

#### Overrides

`Error.constructor`

## Properties

### name

> **name**: `string`

Defined in: errors.ts:101

#### Overrides

`Error.name`

---

### code

> `readonly` **code**: [`ErrorCode`](../type-aliases/ErrorCode.md)

Defined in: errors.ts:102

---

### operation

> `readonly` **operation**: `string`

Defined in: errors.ts:103

---

### channel

> `readonly` **channel**: `string` \| `undefined`

Defined in: errors.ts:104

---

### isRetryable

> `readonly` **isRetryable**: `boolean`

Defined in: errors.ts:105

---

### requestId

> `readonly` **requestId**: `string`

Defined in: errors.ts:106

---

### statusCode

> `readonly` **statusCode**: `number` \| `undefined`

Defined in: errors.ts:107

---

### serverAddress

> `readonly` **serverAddress**: `string` \| `undefined`

Defined in: errors.ts:108

---

### timestamp

> `readonly` **timestamp**: `Date`

Defined in: errors.ts:109

---

### category

> `readonly` **category**: [`ErrorCategory`](../type-aliases/ErrorCategory.md)

Defined in: errors.ts:110

---

### suggestion

> `readonly` **suggestion**: `string` \| `undefined`

Defined in: errors.ts:111

## Methods

### \[hasInstance\]()

> `static` **\[hasInstance\]**(`instance`): `boolean`

Defined in: errors.ts:89

Cross-version instanceof check via well-known symbol.
Only used on the base class — subclass discrimination uses the
standard prototype chain (preserved by Object.setPrototypeOf).

#### Parameters

##### instance

`unknown`

#### Returns

`boolean`

---

### toJSON()

> **toJSON**(): `Record`\<`string`, `unknown`\>

Defined in: errors.ts:130

#### Returns

`Record`\<`string`, `unknown`\>

---

### toSanitizedString()

> **toSanitizedString**(): `string`

Defined in: errors.ts:148

#### Returns

`string`
