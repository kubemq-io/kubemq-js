# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [3.0.0] - 2026-03-11

### ⚠️ BREAKING CHANGES

- **Unified client:** Replaced `PubsubClient`, `CQClient`, and `QueuesClient` with a single `KubeMQClient` class. See [Migration Guide](https://github.com/kubemq-io/kubemq-js/blob/main/docs/MIGRATION-v3.md).
- **Async client creation:** `KubeMQClient.create()` is now async and returns a `Promise<KubeMQClient>`.
- **Error hierarchy:** All errors now extend `KubeMQError` with 19 typed subclasses. Raw `Error` and gRPC `ServiceError` are no longer thrown.
- **Error callbacks:** `onError` callbacks now receive a `KubeMQError` instance instead of a `string`.
- **Auth configuration:** `authToken: string` replaced with `credentials: CredentialProvider | string`.
- **TLS configuration:** Four separate TLS fields (`tls`, `tlsCertFile`, `tlsKeyFile`, `tlsCaCertFile`) replaced with a single `tls: TlsOptions | boolean` nested object.
- **TLS smart default:** TLS is now enabled by default for non-localhost addresses.
- **Cert validation:** TLS certificate validation is now fail-fast at `create()` instead of deferred to first RPC.
- **Subscription API:** Subscriptions now require an `onError` callback. Subscription request classes replaced with options objects.
- **Message creation:** Use factory functions (`createEventMessage()`, `createQueueMessage()`, `createCommand()`, `createQuery()`) instead of object literals with `Utils.stringToBytes()`.
- **Console output removed:** SDK is silent by default. Inject a `Logger` for diagnostic output.
- **Method renames:** `sendEventsMessage()` → `publishEvent()`, `sendEventStoreMessage()` → `publishEventStore()`.
- **Configuration:** `Config` interface replaced with `ClientOptions`. Field renames: `authToken` → `credentials`, `reconnectIntervalSeconds` → `reconnect`.
- **Timeouts:** All operations now have default timeouts (5s send, 10s RPC/subscribe). Previously infinite by default.
- **Module format:** SDK is now ESM-first with CJS compatibility via conditional exports.
- **Node.js 20+:** Minimum Node.js version raised from 14 to 20.11.0.
- **Close semantics:** `client.close()` is now async with drain/flush behavior. Returns `Promise<void>`.
- **Package exports:** `main` field replaced with `exports` map with subpath restrictions.

### Added

- Typed error hierarchy with 19 error classes and `isRetryable` classification
- `ErrorCode` and `ErrorCategory` enums for machine-readable error identification
- Auto-retry engine with configurable exponential backoff and full jitter
- Connection state machine (`IDLE` → `CONNECTING` → `READY` → `RECONNECTING` → `CLOSED`)
- Connection lifecycle events (`onConnected`, `onDisconnected`, `onReconnecting`, `onStateChange`)
- gRPC keepalive configuration via `KeepaliveOptions`
- Graceful shutdown with drain/flush and configurable timeout on `close()`
- Per-operation timeouts with `AbortSignal` support via `OperationOptions`
- `CredentialProvider` interface for pluggable authentication
- `StaticTokenProvider` for simple token auth
- Structured `Logger` interface with `noopLogger` and `createConsoleLogger`
- OpenTelemetry tracing and metrics integration (optional peer dependency)
- W3C Trace Context propagation
- Queue batch send API (`sendQueueMessagesBatch()`)
- `AsyncDisposable` support (`await using client = ...`)
- Message factory functions with input validation (`createEventMessage()`, `createQueueMessage()`, `createCommand()`, `createQuery()`, `createEventStoreMessage()`)
- Comprehensive TSDoc on all public types
- TypeDoc-generated API reference
- Examples for all messaging patterns
- Troubleshooting guide (`docs/TROUBLESHOOTING.md`)
- Error handling guide (`docs/ERROR-HANDLING.md`)
- Migration guide v2 → v3 (`docs/MIGRATION-v3.md`)
- CONTRIBUTING.md with development setup and PR guidelines
- CI/CD pipeline with GitHub Actions

### Fixed

- `EventStreamHelper` single-Promise bug: subsequent `sendEventStoreMessage` calls no longer return stale results
- `QueriesSubscriptionRequest.reconnect()` now correctly subscribes to queries (was subscribing to commands)
- `deleteEventsChannel` JSDoc no longer says "Delete commands channel"
- `Utils.bytesToString()` no longer stack-overflows on large byte arrays

### Removed

- `PubsubClient` class (use `KubeMQClient`)
- `CQClient` class (use `KubeMQClient`)
- `QueuesClient` class (use `KubeMQClient`)
- `Config` interface (use `ClientOptions`)
- `Utils` class (use standard `TextEncoder`/`TextDecoder`)
- `TypedEvent` class (dead code)
- `rxjs` dependency (unused)
- `grpc-tools` moved from production to devDependencies
- All `console.log/error/debug` calls from SDK source

## [2.1.0] - 2024-08-15

### Added

- Queue message visibility timeout support
- Queue message ack, reject, and requeue operations
- `QueuesPollRequest` with `visibilitySeconds` and `autoAckMessages`
- Queue stream send/receive operations
- Visibility timer extension (`extendVisibilityTimer()`)

## [2.0.0] - 2024-01-10

### Added

- Initial TypeScript rewrite of the KubeMQ SDK
- Three-client architecture: `PubsubClient`, `CQClient`, `QueuesClient`
- Events publish/subscribe support
- Events Store publish/subscribe with replay options (`EventStoreType`)
- Queues send/receive/peek/pull support
- Commands send/subscribe support
- Queries send/subscribe support
- Channel CRUD operations (create, delete, list)
- TLS support via `tlsCertFile`, `tlsKeyFile`, `tlsCaCertFile`
- Auth token support via `authToken`
- TypeDoc-generated HTML documentation
- Example files for all messaging patterns

[Unreleased]: https://github.com/kubemq-io/kubemq-js/compare/v3.0.0...HEAD
[3.0.0]: https://github.com/kubemq-io/kubemq-js/compare/v2.1.0...v3.0.0
[2.1.0]: https://github.com/kubemq-io/kubemq-js/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/kubemq-io/kubemq-js/releases/tag/v2.0.0
