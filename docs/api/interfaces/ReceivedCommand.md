[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / CommandReceived

# Interface: CommandReceived

Defined in: messages/commands.ts:35

Received RPC command from a subscription.

## Remarks

**Async safety:** Safe to read from multiple async contexts concurrently.
Do not modify received message objects — they are shared references from
the subscription's delivery pipeline. Fields are readonly.

## Properties

### id

> `readonly` **id**: `string`

Defined in: messages/commands.ts:36

---

### channel

> `readonly` **channel**: `string`

Defined in: messages/commands.ts:37

---

### fromClientId

> `readonly` **fromClientId**: `string`

Defined in: messages/commands.ts:38

---

### timestamp

> `readonly` **timestamp**: `Date`

Defined in: messages/commands.ts:39

---

### body

> `readonly` **body**: `Uint8Array`

Defined in: messages/commands.ts:40

---

### metadata

> `readonly` **metadata**: `string`

Defined in: messages/commands.ts:41

---

### replyChannel

> `readonly` **replyChannel**: `string`

Defined in: messages/commands.ts:42

---

### tags

> `readonly` **tags**: `Record`\<`string`, `string`\>

Defined in: messages/commands.ts:43
