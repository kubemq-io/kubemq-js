[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / PartialFailureErrorOptions

# Interface: PartialFailureErrorOptions

Defined in: errors.ts:73

## Extends

- [`KubeMQErrorOptions`](KubeMQErrorOptions.md)

## Properties

### code?

> `optional` **code**: [`ErrorCode`](../type-aliases/ErrorCode.md)

Defined in: errors.ts:48

#### Inherited from

[`KubeMQErrorOptions`](KubeMQErrorOptions.md).[`code`](KubeMQErrorOptions.md#code)

---

### message

> **message**: `string`

Defined in: errors.ts:49

#### Inherited from

[`KubeMQErrorOptions`](KubeMQErrorOptions.md).[`message`](KubeMQErrorOptions.md#message)

---

### operation

> **operation**: `string`

Defined in: errors.ts:50

#### Inherited from

[`KubeMQErrorOptions`](KubeMQErrorOptions.md).[`operation`](KubeMQErrorOptions.md#operation)

---

### channel?

> `optional` **channel**: `string`

Defined in: errors.ts:51

#### Inherited from

[`KubeMQErrorOptions`](KubeMQErrorOptions.md).[`channel`](KubeMQErrorOptions.md#channel)

---

### isRetryable?

> `optional` **isRetryable**: `boolean`

Defined in: errors.ts:52

#### Inherited from

[`KubeMQErrorOptions`](KubeMQErrorOptions.md).[`isRetryable`](KubeMQErrorOptions.md#isretryable)

---

### cause?

> `optional` **cause**: `Error`

Defined in: errors.ts:53

#### Inherited from

[`KubeMQErrorOptions`](KubeMQErrorOptions.md).[`cause`](KubeMQErrorOptions.md#cause)

---

### requestId?

> `optional` **requestId**: `string`

Defined in: errors.ts:54

#### Inherited from

[`KubeMQErrorOptions`](KubeMQErrorOptions.md).[`requestId`](KubeMQErrorOptions.md#requestid)

---

### statusCode?

> `optional` **statusCode**: `number`

Defined in: errors.ts:55

#### Inherited from

[`KubeMQErrorOptions`](KubeMQErrorOptions.md).[`statusCode`](KubeMQErrorOptions.md#statuscode)

---

### serverAddress?

> `optional` **serverAddress**: `string`

Defined in: errors.ts:56

#### Inherited from

[`KubeMQErrorOptions`](KubeMQErrorOptions.md).[`serverAddress`](KubeMQErrorOptions.md#serveraddress)

---

### suggestion?

> `optional` **suggestion**: `string`

Defined in: errors.ts:57

#### Inherited from

[`KubeMQErrorOptions`](KubeMQErrorOptions.md).[`suggestion`](KubeMQErrorOptions.md#suggestion)

---

### retryAttempts?

> `optional` **retryAttempts**: `number`

Defined in: errors.ts:58

#### Inherited from

[`KubeMQErrorOptions`](KubeMQErrorOptions.md).[`retryAttempts`](KubeMQErrorOptions.md#retryattempts)

---

### maxRetries?

> `optional` **maxRetries**: `number`

Defined in: errors.ts:59

#### Inherited from

[`KubeMQErrorOptions`](KubeMQErrorOptions.md).[`maxRetries`](KubeMQErrorOptions.md#maxretries)

---

### retryDuration?

> `optional` **retryDuration**: `number`

Defined in: errors.ts:60

#### Inherited from

[`KubeMQErrorOptions`](KubeMQErrorOptions.md).[`retryDuration`](KubeMQErrorOptions.md#retryduration)

---

### failures

> **failures**: `object`[]

Defined in: errors.ts:74

#### index

> **index**: `number`

#### error

> **error**: [`KubeMQError`](../classes/KubeMQError.md)
