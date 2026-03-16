[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / EventMessage

# Interface: EventMessage

Defined in: messages/events.ts:18

Outbound event message.

## Remarks

**Async safety:** Not safe for concurrent modification. Create a new instance
per send operation. Do not share outbound message objects between concurrent
async operations. Message objects are frozen (`Object.freeze()`) by factory
functions — modification after creation throws a `TypeError`.

## Properties

### channel

> `readonly` **channel**: `string`

Defined in: messages/events.ts:19

---

### body?

> `readonly` `optional` **body**: [`MessageBody`](../type-aliases/MessageBody.md)

Defined in: messages/events.ts:20

---

### metadata?

> `readonly` `optional` **metadata**: `string`

Defined in: messages/events.ts:21

---

### tags?

> `readonly` `optional` **tags**: `Record`\<`string`, `string`\>

Defined in: messages/events.ts:22

---

### id?

> `readonly` `optional` **id**: `string`

Defined in: messages/events.ts:23

---

### clientId?

> `readonly` `optional` **clientId**: `string`

Defined in: messages/events.ts:24
