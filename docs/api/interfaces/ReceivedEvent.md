[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / EventReceived

# Interface: EventReceived

Defined in: messages/events.ts:35

Received event from a subscription.

## Remarks

**Async safety:** Safe to read from multiple async contexts concurrently.
Do not modify received message objects — they are shared references from
the subscription's delivery pipeline. Fields are readonly.

## Properties

### id

> `readonly` **id**: `string`

Defined in: messages/events.ts:36

---

### channel

> `readonly` **channel**: `string`

Defined in: messages/events.ts:37

---

### timestamp

> `readonly` **timestamp**: `Date`

Defined in: messages/events.ts:38

---

### body

> `readonly` **body**: `Uint8Array`

Defined in: messages/events.ts:39

---

### metadata

> `readonly` **metadata**: `string`

Defined in: messages/events.ts:40

---

### tags

> `readonly` **tags**: `Record`\<`string`, `string`\>

Defined in: messages/events.ts:41
