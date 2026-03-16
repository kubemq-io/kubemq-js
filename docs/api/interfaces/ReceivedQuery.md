[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / ReceivedQuery

# Interface: ReceivedQuery

Defined in: messages/queries.ts:37

Received RPC query from a subscription.

## Remarks

**Async safety:** Safe to read from multiple async contexts concurrently.
Do not modify received message objects — they are shared references from
the subscription's delivery pipeline. Fields are readonly.

## Properties

### id

> `readonly` **id**: `string`

Defined in: messages/queries.ts:38

---

### channel

> `readonly` **channel**: `string`

Defined in: messages/queries.ts:39

---

### fromClientId

> `readonly` **fromClientId**: `string`

Defined in: messages/queries.ts:40

---

### timestamp

> `readonly` **timestamp**: `Date`

Defined in: messages/queries.ts:41

---

### body

> `readonly` **body**: `Uint8Array`

Defined in: messages/queries.ts:42

---

### metadata

> `readonly` **metadata**: `string`

Defined in: messages/queries.ts:43

---

### replyChannel

> `readonly` **replyChannel**: `string`

Defined in: messages/queries.ts:44

---

### tags

> `readonly` **tags**: `Record`\<`string`, `string`\>

Defined in: messages/queries.ts:45
