[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / CommandMessage

# Interface: CommandMessage

Defined in: messages/commands.ts:16

Outbound RPC command message.

## Remarks

**Async safety:** Not safe for concurrent modification. Create a new instance
per send operation. Do not share outbound message objects between concurrent
async operations. Message objects are frozen (`Object.freeze()`) by factory
functions — modification after creation throws a `TypeError`.

## Properties

### channel

> `readonly` **channel**: `string`

Defined in: messages/commands.ts:17

---

### body?

> `readonly` `optional` **body**: [`MessageBody`](../type-aliases/MessageBody.md)

Defined in: messages/commands.ts:18

---

### metadata?

> `readonly` `optional` **metadata**: `string`

Defined in: messages/commands.ts:19

---

### tags?

> `readonly` `optional` **tags**: `Record`\<`string`, `string`\>

Defined in: messages/commands.ts:20

---

### timeoutMs

> `readonly` **timeoutMs**: `number`

Defined in: messages/commands.ts:21

---

### id?

> `readonly` `optional` **id**: `string`

Defined in: messages/commands.ts:22

---

### clientId?

> `readonly` `optional` **clientId**: `string`

Defined in: messages/commands.ts:23

---

### span?

> `readonly` `optional` **span**: `Uint8Array`\<`ArrayBufferLike`\>

Defined in: messages/commands.ts:24
