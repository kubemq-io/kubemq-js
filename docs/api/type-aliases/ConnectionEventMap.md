[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / ConnectionEventMap

# Type Alias: ConnectionEventMap

> **ConnectionEventMap** = `object`

Defined in: internal/transport/typed-emitter.ts:6

## Properties

### connected()

> **connected**: () => `void`

Defined in: internal/transport/typed-emitter.ts:7

#### Returns

`void`

---

### disconnected()

> **disconnected**: () => `void`

Defined in: internal/transport/typed-emitter.ts:8

#### Returns

`void`

---

### reconnecting()

> **reconnecting**: (`attempt`) => `void`

Defined in: internal/transport/typed-emitter.ts:9

#### Parameters

##### attempt

`number`

#### Returns

`void`

---

### reconnected()

> **reconnected**: () => `void`

Defined in: internal/transport/typed-emitter.ts:10

#### Returns

`void`

---

### closed()

> **closed**: () => `void`

Defined in: internal/transport/typed-emitter.ts:11

#### Returns

`void`

---

### bufferDrain()

> **bufferDrain**: (`discardedCount`) => `void`

Defined in: internal/transport/typed-emitter.ts:12

#### Parameters

##### discardedCount

`number`

#### Returns

`void`

---

### stateChange()

> **stateChange**: (`state`) => `void`

Defined in: internal/transport/typed-emitter.ts:13

#### Parameters

##### state

`ConnectionState`

#### Returns

`void`
