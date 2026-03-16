[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / KubeMQErrorOptions

# Interface: KubeMQErrorOptions

Defined in: errors.ts:47

## Extended by

- [`StreamBrokenErrorOptions`](StreamBrokenErrorOptions.md)
- [`RetryExhaustedErrorOptions`](RetryExhaustedErrorOptions.md)
- [`PartialFailureErrorOptions`](PartialFailureErrorOptions.md)

## Properties

### code?

> `optional` **code**: [`ErrorCode`](../type-aliases/ErrorCode.md)

Defined in: errors.ts:48

---

### message

> **message**: `string`

Defined in: errors.ts:49

---

### operation

> **operation**: `string`

Defined in: errors.ts:50

---

### channel?

> `optional` **channel**: `string`

Defined in: errors.ts:51

---

### isRetryable?

> `optional` **isRetryable**: `boolean`

Defined in: errors.ts:52

---

### cause?

> `optional` **cause**: `Error`

Defined in: errors.ts:53

---

### requestId?

> `optional` **requestId**: `string`

Defined in: errors.ts:54

---

### statusCode?

> `optional` **statusCode**: `number`

Defined in: errors.ts:55

---

### serverAddress?

> `optional` **serverAddress**: `string`

Defined in: errors.ts:56

---

### suggestion?

> `optional` **suggestion**: `string`

Defined in: errors.ts:57

---

### retryAttempts?

> `optional` **retryAttempts**: `number`

Defined in: errors.ts:58

---

### maxRetries?

> `optional` **maxRetries**: `number`

Defined in: errors.ts:59

---

### retryDuration?

> `optional` **retryDuration**: `number`

Defined in: errors.ts:60
