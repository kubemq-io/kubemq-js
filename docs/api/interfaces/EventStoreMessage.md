[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / EventStoreMessage

# Interface: EventStoreMessage

Defined in: messages/events-store.ts:25

Outbound persistent event message.

## Remarks

**Async safety:** Not safe for concurrent modification. Create a new instance
per send operation. Do not share outbound message objects between concurrent
async operations. Message objects are frozen (`Object.freeze()`) by factory
functions — modification after creation throws a `TypeError`.

## Properties

### channel

> `readonly` **channel**: `string`

Defined in: messages/events-store.ts:26

---

### body?

> `readonly` `optional` **body**: [`MessageBody`](../type-aliases/MessageBody.md)

Defined in: messages/events-store.ts:27

---

### metadata?

> `readonly` `optional` **metadata**: `string`

Defined in: messages/events-store.ts:28

---

### tags?

> `readonly` `optional` **tags**: `Record`\<`string`, `string`\>

Defined in: messages/events-store.ts:29

---

### id?

> `readonly` `optional` **id**: `string`

Defined in: messages/events-store.ts:30

---

### clientId?

> `readonly` `optional` **clientId**: `string`

Defined in: messages/events-store.ts:31
