# KubeMQ JS/TS SDK — Compatibility Matrix

## SDK ↔ Server Version Matrix

| SDK Version | Server ≥ 1.0 | Server ≥ 2.0 | Server ≥ 3.0 | Notes                          |
| ----------- | :----------: | :----------: | :----------: | ------------------------------ |
| v1.x        |      ✅      |      ✅      |      ✅      | Legacy, EOL                    |
| v2.x        |      ❌      |      ✅      |      ✅      | Maintenance                    |
| v3.x        |      ❌      |      ❌      |      ✅      | Current — new queue stream API |

## Node.js Runtime Support

| SDK Version | Node.js 14 | Node.js 16 | Node.js 18 | Node.js 20 | Node.js 22 | Node.js 24 |
| ----------- | :--------: | :--------: | :--------: | :--------: | :--------: | :--------: |
| v2.x        |     ✅     |     ✅     |     ✅     |     ✅     |     ✅     |     ✅     |
| v3.x        |     ❌     |     ❌     |     ❌     |     ✅     |     ✅     |     ✅     |

## TypeScript Support

| SDK Version | TypeScript |
| ----------- | ---------- |
| v3.x        | ≥ 5.0      |

## Node.js Feature Availability

Features used by the SDK and their availability across supported Node.js versions:

| Feature               | Node.js 20 | Node.js 22 | Node.js 24 |
| --------------------- | :--------: | :--------: | :--------: |
| `fetch` (global)      |     ✅     |     ✅     |     ✅     |
| `AbortController`     |     ✅     |     ✅     |     ✅     |
| `structuredClone`     |     ✅     |     ✅     |     ✅     |
| `crypto.randomUUID()` |     ✅     |     ✅     |     ✅     |
| `Symbol.asyncDispose` |    ❌\*    |     ✅     |     ✅     |
| `await using`         |    ❌\*    |     ✅     |     ✅     |
| `AbortSignal.any()`   |     ❌     |     ✅     |     ✅     |

\* Requires TypeScript 5.2+ downlevel emit; runtime polyfill needed for `Symbol.dispose`.

## Server Version Detection

On first connection, the SDK checks the server version (via `ping()`) against the
tested range. If the server version is below v3.0.0, the SDK logs a warning through
the pluggable logger. The connection always proceeds — the warning is informational only.

_This matrix is updated with each SDK release._
