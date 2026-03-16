[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / QueueMessage

# Interface: QueueMessage

Defined in: messages/queues.ts:23

Outbound queue message.

## Remarks

**Async safety:** Not safe for concurrent modification. Create a new instance
per send operation. Do not share outbound message objects between concurrent
async operations. Message objects are frozen (`Object.freeze()`) by factory
functions — modification after creation throws a `TypeError`.

## Properties

### channel

> `readonly` **channel**: `string`

Defined in: messages/queues.ts:24

---

### body?

> `readonly` `optional` **body**: [`MessageBody`](../type-aliases/MessageBody.md)

Defined in: messages/queues.ts:25

---

### metadata?

> `readonly` `optional` **metadata**: `string`

Defined in: messages/queues.ts:26

---

### tags?

> `readonly` `optional` **tags**: `Record`\<`string`, `string`\>

Defined in: messages/queues.ts:27

---

### policy?

> `readonly` `optional` **policy**: [`QueueMessagePolicy`](QueueMessagePolicy.md)

Defined in: messages/queues.ts:28

---

### id?

> `readonly` `optional` **id**: `string`

Defined in: messages/queues.ts:29

---

### clientId?

> `readonly` `optional` **clientId**: `string`

Defined in: messages/queues.ts:30
