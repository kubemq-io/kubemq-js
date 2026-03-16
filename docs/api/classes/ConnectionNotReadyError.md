[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / ConnectionNotReadyError

# Class: ConnectionNotReadyError

Defined in: errors.ts:351

## Extends

- [`ConnectionError`](ConnectionError.md)

## Constructors

### Constructor

> **new ConnectionNotReadyError**(`options`): `ConnectionNotReadyError`

Defined in: errors.ts:354

#### Parameters

##### options

[`KubeMQErrorOptions`](../interfaces/KubeMQErrorOptions.md)

#### Returns

`ConnectionNotReadyError`

#### Overrides

[`ConnectionError`](ConnectionError.md).[`constructor`](ConnectionError.md#constructor)

## Properties

### name

> **name**: `string`

Defined in: errors.ts:101

#### Inherited from

[`ConnectionError`](ConnectionError.md).[`name`](ConnectionError.md#name)

---

### code

> `readonly` **code**: [`ErrorCode`](../type-aliases/ErrorCode.md)

Defined in: errors.ts:102

#### Inherited from

[`ConnectionError`](ConnectionError.md).[`code`](ConnectionError.md#code)

---

### operation

> `readonly` **operation**: `string`

Defined in: errors.ts:103

#### Inherited from

[`ConnectionError`](ConnectionError.md).[`operation`](ConnectionError.md#operation)

---

### channel

> `readonly` **channel**: `string` \| `undefined`

Defined in: errors.ts:104

#### Inherited from

[`ConnectionError`](ConnectionError.md).[`channel`](ConnectionError.md#channel)

---

### isRetryable

> `readonly` **isRetryable**: `boolean`

Defined in: errors.ts:105

#### Inherited from

[`ConnectionError`](ConnectionError.md).[`isRetryable`](ConnectionError.md#isretryable)

---

### requestId

> `readonly` **requestId**: `string`

Defined in: errors.ts:106

#### Inherited from

[`ConnectionError`](ConnectionError.md).[`requestId`](ConnectionError.md#requestid)

---

### statusCode

> `readonly` **statusCode**: `number` \| `undefined`

Defined in: errors.ts:107

#### Inherited from

[`ConnectionError`](ConnectionError.md).[`statusCode`](ConnectionError.md#statuscode)

---

### serverAddress

> `readonly` **serverAddress**: `string` \| `undefined`

Defined in: errors.ts:108

#### Inherited from

[`ConnectionError`](ConnectionError.md).[`serverAddress`](ConnectionError.md#serveraddress)

---

### timestamp

> `readonly` **timestamp**: `Date`

Defined in: errors.ts:109

#### Inherited from

[`ConnectionError`](ConnectionError.md).[`timestamp`](ConnectionError.md#timestamp)

---

### suggestion

> `readonly` **suggestion**: `string` \| `undefined`

Defined in: errors.ts:111

#### Inherited from

[`ConnectionError`](ConnectionError.md).[`suggestion`](ConnectionError.md#suggestion)

---

### category

> `readonly` **category**: `"Transient"` = `ErrorCategory.Transient`

Defined in: errors.ts:352

#### Overrides

[`ConnectionError`](ConnectionError.md).[`category`](ConnectionError.md#category)

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

#### Inherited from

[`ConnectionError`](ConnectionError.md).[`[hasInstance]`](ConnectionError.md#hasinstance)

---

### toJSON()

> **toJSON**(): `Record`\<`string`, `unknown`\>

Defined in: errors.ts:130

#### Returns

`Record`\<`string`, `unknown`\>

#### Inherited from

[`ConnectionError`](ConnectionError.md).[`toJSON`](ConnectionError.md#tojson)

---

### toSanitizedString()

> **toSanitizedString**(): `string`

Defined in: errors.ts:148

#### Returns

`string`

#### Inherited from

[`ConnectionError`](ConnectionError.md).[`toSanitizedString`](ConnectionError.md#tosanitizedstring)
