[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / ClientOptions

# Interface: ClientOptions

Defined in: options.ts:138

## Properties

### address

> **address**: `string`

Defined in: options.ts:139

---

### clientId?

> `optional` **clientId**: `string`

Defined in: options.ts:140

---

### credentials?

> `optional` **credentials**: `string` \| [`CredentialProvider`](CredentialProvider.md)

Defined in: options.ts:141

---

### tls?

> `optional` **tls**: `boolean` \| [`TlsOptions`](TlsOptions.md)

Defined in: options.ts:142

---

### keepalive?

> `optional` **keepalive**: [`KeepaliveOptions`](KeepaliveOptions.md)

Defined in: options.ts:143

---

### retry?

> `optional` **retry**: [`RetryPolicy`](RetryPolicy.md)

Defined in: options.ts:144

---

### reconnect?

> `optional` **reconnect**: [`ReconnectionPolicy`](ReconnectionPolicy.md)

Defined in: options.ts:145

---

### connectionTimeoutMs?

> `optional` **connectionTimeoutMs**: `number`

Defined in: options.ts:146

---

### maxReceiveMessageSize?

> `optional` **maxReceiveMessageSize**: `number`

Defined in: options.ts:147

---

### maxSendMessageSize?

> `optional` **maxSendMessageSize**: `number`

Defined in: options.ts:148

---

### waitForReady?

> `optional` **waitForReady**: `boolean`

Defined in: options.ts:149

---

### logger?

> `optional` **logger**: [`Logger`](Logger.md)

Defined in: options.ts:150

---

### tracerProvider?

> `optional` **tracerProvider**: `unknown`

Defined in: options.ts:151

---

### meterProvider?

> `optional` **meterProvider**: `unknown`

Defined in: options.ts:152

---

### reconnectBufferSize?

> `optional` **reconnectBufferSize**: `number`

Defined in: options.ts:153

---

### reconnectBufferMode?

> `optional` **reconnectBufferMode**: `"error"` \| `"block"`

Defined in: options.ts:154

---

### maxConcurrentRetries?

> `optional` **maxConcurrentRetries**: `number`

Defined in: options.ts:155

---

### defaultSendTimeoutMs?

> `optional` **defaultSendTimeoutMs**: `number`

Defined in: options.ts:156

---

### defaultSubscribeTimeoutMs?

> `optional` **defaultSubscribeTimeoutMs**: `number`

Defined in: options.ts:157

---

### defaultRpcTimeoutMs?

> `optional` **defaultRpcTimeoutMs**: `number`

Defined in: options.ts:158

---

### defaultQueueReceiveTimeoutMs?

> `optional` **defaultQueueReceiveTimeoutMs**: `number`

Defined in: options.ts:159

---

### defaultQueuePollTimeoutMs?

> `optional` **defaultQueuePollTimeoutMs**: `number`

Defined in: options.ts:160
