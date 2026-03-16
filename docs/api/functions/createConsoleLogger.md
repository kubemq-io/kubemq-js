[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / createConsoleLogger

# Function: createConsoleLogger()

> **createConsoleLogger**(`level`): [`Logger`](../interfaces/Logger.md)

Defined in: logger.ts:53

Creates a console-based logger filtered by level.
Intended for development/debugging — NOT used internally by the SDK.

## Parameters

### level

[`LogLevel`](../type-aliases/LogLevel.md)

## Returns

[`Logger`](../interfaces/Logger.md)

## Example

```ts
import { createConsoleLogger } from 'kubemq-js';

const client = await KubeMQClient.create({
  address: 'localhost:50000',
  logger: createConsoleLogger('debug'),
});
```
