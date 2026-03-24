[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / ResolvedClientOptions

# Interface: ResolvedClientOptions

Defined in: internal/config-defaults.ts:30

Fully-resolved configuration after defaults are applied.
Unlike `Required<ClientOptions>`, `credentials`, `tracerProvider`,
and `meterProvider` remain optional (no sensible non-undefined default).

## Properties

### address

> `readonly` **address**: `string`

Defined in: internal/config-defaults.ts:31

---

### clientId

> `readonly` **clientId**: `string`

Defined in: internal/config-defaults.ts:32

---

### credentials

> `readonly` **credentials**: `string` \| [`CredentialProvider`](CredentialProvider.md) \| `undefined`

Defined in: internal/config-defaults.ts:33

---

### tls

> `readonly` **tls**: `boolean` \| [`TlsOptions`](TlsOptions.md)

Defined in: internal/config-defaults.ts:34

---

### keepalive

> `readonly` **keepalive**: `Readonly`\<`Required`\<[`KeepaliveOptions`](KeepaliveOptions.md)\>\>

Defined in: internal/config-defaults.ts:35

---

### retry

> `readonly` **retry**: `Readonly`\<`Required`\<[`RetryPolicy`](RetryPolicy.md)\>\>

Defined in: internal/config-defaults.ts:36

---

### reconnect

> `readonly` **reconnect**: `Readonly`\<`Required`\<[`ReconnectionPolicy`](ReconnectionPolicy.md)\>\>

Defined in: internal/config-defaults.ts:37

---

### connectionTimeoutSeconds

> `readonly` **connectionTimeoutSeconds**: `number`

Defined in: internal/config-defaults.ts:38

---

### maxReceiveMessageSize

> `readonly` **maxReceiveMessageSize**: `number`

Defined in: internal/config-defaults.ts:39

---

### maxSendMessageSize

> `readonly` **maxSendMessageSize**: `number`

Defined in: internal/config-defaults.ts:40

---

### waitForReady

> `readonly` **waitForReady**: `boolean`

Defined in: internal/config-defaults.ts:41

---

### logger

> `readonly` **logger**: [`Logger`](Logger.md)

Defined in: internal/config-defaults.ts:42

---

### tracerProvider

> `readonly` **tracerProvider**: `unknown`

Defined in: internal/config-defaults.ts:43

---

### meterProvider

> `readonly` **meterProvider**: `unknown`

Defined in: internal/config-defaults.ts:44

---

### reconnectBufferSize

> `readonly` **reconnectBufferSize**: `number`

Defined in: internal/config-defaults.ts:45

---

### reconnectBufferMode

> `readonly` **reconnectBufferMode**: `"error"` \| `"block"`

Defined in: internal/config-defaults.ts:46

---

### maxConcurrentRetries

> `readonly` **maxConcurrentRetries**: `number`

Defined in: internal/config-defaults.ts:47

---

### defaultSendTimeoutSeconds

> `readonly` **defaultSendTimeoutSeconds**: `number`

Defined in: internal/config-defaults.ts:48

---

### defaultSubscribeTimeoutSeconds

> `readonly` **defaultSubscribeTimeoutSeconds**: `number`

Defined in: internal/config-defaults.ts:49

---

### defaultRpcTimeoutSeconds

> `readonly` **defaultRpcTimeoutSeconds**: `number`

Defined in: internal/config-defaults.ts:50

---

### defaultQueueReceiveTimeoutSeconds

> `readonly` **defaultQueueReceiveTimeoutSeconds**: `number`

Defined in: internal/config-defaults.ts:51

---

### defaultQueuePollTimeoutSeconds

> `readonly` **defaultQueuePollTimeoutSeconds**: `number`

Defined in: internal/config-defaults.ts:52
