[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / QueryMessage

# Interface: QueryMessage

Defined in: messages/queries.ts:16

Outbound RPC query message.

## Remarks

**Async safety:** Not safe for concurrent modification. Create a new instance
per send operation. Do not share outbound message objects between concurrent
async operations. Message objects are frozen (`Object.freeze()`) by factory
functions — modification after creation throws a `TypeError`.

## Properties

### channel

> `readonly` **channel**: `string`

Defined in: messages/queries.ts:17

---

### body?

> `readonly` `optional` **body**: [`MessageBody`](../type-aliases/MessageBody.md)

Defined in: messages/queries.ts:18

---

### metadata?

> `readonly` `optional` **metadata**: `string`

Defined in: messages/queries.ts:19

---

### tags?

> `readonly` `optional` **tags**: `Record`\<`string`, `string`\>

Defined in: messages/queries.ts:20

---

### timeoutInSeconds

> `readonly` **timeoutInSeconds**: `number`

Defined in: messages/queries.ts:21

---

### cacheKey?

> `readonly` `optional` **cacheKey**: `string`

Defined in: messages/queries.ts:22

---

### cacheTtlInSeconds?

> `readonly` `optional` **cacheTtlInSeconds**: `number`

Defined in: messages/queries.ts:23

---

### id?

> `readonly` `optional` **id**: `string`

Defined in: messages/queries.ts:24

---

### clientId?

> `readonly` `optional` **clientId**: `string`

Defined in: messages/queries.ts:25

---

### span?

> `readonly` `optional` **span**: `Uint8Array`\<`ArrayBufferLike`\>

Defined in: messages/queries.ts:26
