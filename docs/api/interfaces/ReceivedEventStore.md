[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / EventStoreReceived

# Interface: EventStoreReceived

Defined in: messages/events-store.ts:42

Received persistent event from a subscription.

## Remarks

**Async safety:** Safe to read from multiple async contexts concurrently.
Do not modify received message objects — they are shared references from
the subscription's delivery pipeline. Fields are readonly.

## Properties

### id

> `readonly` **id**: `string`

Defined in: messages/events-store.ts:43

---

### channel

> `readonly` **channel**: `string`

Defined in: messages/events-store.ts:44

---

### timestamp

> `readonly` **timestamp**: `Date`

Defined in: messages/events-store.ts:45

---

### body

> `readonly` **body**: `Uint8Array`

Defined in: messages/events-store.ts:46

---

### metadata

> `readonly` **metadata**: `string`

Defined in: messages/events-store.ts:47

---

### tags

> `readonly` **tags**: `Record`\<`string`, `string`\>

Defined in: messages/events-store.ts:48

---

### sequence

> `readonly` **sequence**: `number`

Defined in: messages/events-store.ts:49
