[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / NotImplementedError

# Class: NotImplementedError

Defined in: errors.ts:405

## Extends

- [`KubeMQError`](KubeMQError.md)

## Constructors

### Constructor

> **new NotImplementedError**(`options`): `NotImplementedError`

Defined in: errors.ts:408

#### Parameters

##### options

[`KubeMQErrorOptions`](../interfaces/KubeMQErrorOptions.md)

#### Returns

`NotImplementedError`

#### Overrides

[`KubeMQError`](KubeMQError.md).[`constructor`](KubeMQError.md#constructor)

## Properties

### name

> **name**: `string`

Defined in: errors.ts:101

#### Inherited from

[`KubeMQError`](KubeMQError.md).[`name`](KubeMQError.md#name)

---

### code

> `readonly` **code**: [`ErrorCode`](../type-aliases/ErrorCode.md)

Defined in: errors.ts:102

#### Inherited from

[`KubeMQError`](KubeMQError.md).[`code`](KubeMQError.md#code)

---

### operation

> `readonly` **operation**: `string`

Defined in: errors.ts:103

#### Inherited from

[`KubeMQError`](KubeMQError.md).[`operation`](KubeMQError.md#operation)

---

### channel

> `readonly` **channel**: `string` \| `undefined`

Defined in: errors.ts:104

#### Inherited from

[`KubeMQError`](KubeMQError.md).[`channel`](KubeMQError.md#channel)

---

### isRetryable

> `readonly` **isRetryable**: `boolean`

Defined in: errors.ts:105

#### Inherited from

[`KubeMQError`](KubeMQError.md).[`isRetryable`](KubeMQError.md#isretryable)

---

### requestId

> `readonly` **requestId**: `string`

Defined in: errors.ts:106

#### Inherited from

[`KubeMQError`](KubeMQError.md).[`requestId`](KubeMQError.md#requestid)

---

### statusCode

> `readonly` **statusCode**: `number` \| `undefined`

Defined in: errors.ts:107

#### Inherited from

[`KubeMQError`](KubeMQError.md).[`statusCode`](KubeMQError.md#statuscode)

---

### serverAddress

> `readonly` **serverAddress**: `string` \| `undefined`

Defined in: errors.ts:108

#### Inherited from

[`KubeMQError`](KubeMQError.md).[`serverAddress`](KubeMQError.md#serveraddress)

---

### timestamp

> `readonly` **timestamp**: `Date`

Defined in: errors.ts:109

#### Inherited from

[`KubeMQError`](KubeMQError.md).[`timestamp`](KubeMQError.md#timestamp)

---

### suggestion

> `readonly` **suggestion**: `string` \| `undefined`

Defined in: errors.ts:111

#### Inherited from

[`KubeMQError`](KubeMQError.md).[`suggestion`](KubeMQError.md#suggestion)

---

### category

> `readonly` **category**: `"Fatal"` = `ErrorCategory.Fatal`

Defined in: errors.ts:406

#### Overrides

[`KubeMQError`](KubeMQError.md).[`category`](KubeMQError.md#category)

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

[`KubeMQError`](KubeMQError.md).[`[hasInstance]`](KubeMQError.md#hasinstance)

---

### toJSON()

> **toJSON**(): `Record`\<`string`, `unknown`\>

Defined in: errors.ts:130

#### Returns

`Record`\<`string`, `unknown`\>

#### Inherited from

[`KubeMQError`](KubeMQError.md).[`toJSON`](KubeMQError.md#tojson)

---

### toSanitizedString()

> **toSanitizedString**(): `string`

Defined in: errors.ts:148

#### Returns

`string`

#### Inherited from

[`KubeMQError`](KubeMQError.md).[`toSanitizedString`](KubeMQError.md#tosanitizedstring)
