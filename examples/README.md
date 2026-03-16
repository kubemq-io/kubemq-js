# KubeMQ JS/TS SDK Examples

Runnable examples demonstrating all messaging patterns and configuration options for the KubeMQ JS/TS SDK v3.

## Prerequisites

- Node.js 20+
- KubeMQ server running on `localhost:50000`
- Install dependencies: `npm install`

## Events

Fire-and-forget messages delivered to all active subscribers on a channel.

| Example                                                     | Description                                              | Run                                                |
| ----------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------- |
| [basic-pubsub.ts](events/basic-pubsub.ts)                   | Basic event publish/subscribe                            | `npx tsx examples/events/basic-pubsub.ts`          |
| [wildcard-subscription.ts](events/wildcard-subscription.ts) | Subscribe using wildcard channel patterns                | `npx tsx examples/events/wildcard-subscription.ts` |
| [multiple-subscribers.ts](events/multiple-subscribers.ts)   | Multiple subscribers receiving the same events (fan-out) | `npx tsx examples/events/multiple-subscribers.ts`  |

## Events Store

Persistent events that can be replayed by subscribers, even after the events were published.

| Example                                                         | Description                            | Run                                                     |
| --------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------- |
| [persistent-pubsub.ts](events-store/persistent-pubsub.ts)       | Persistent event publish/subscribe     | `npx tsx examples/events-store/persistent-pubsub.ts`    |
| [replay-from-sequence.ts](events-store/replay-from-sequence.ts) | Replay from a specific sequence number | `npx tsx examples/events-store/replay-from-sequence.ts` |
| [replay-from-time.ts](events-store/replay-from-time.ts)         | Replay from a time delta (seconds ago) | `npx tsx examples/events-store/replay-from-time.ts`     |
| [replay-from-first.ts](events-store/replay-from-first.ts)       | Replay all events from the beginning   | `npx tsx examples/events-store/replay-from-first.ts`    |

## Queues

Pull-based messaging with acknowledgment, rejection, dead-letter queues, and delayed delivery.

| Example                                             | Description                                         | Run                                            |
| --------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------- |
| [send-receive.ts](queues/send-receive.ts)           | Basic queue send and receive with ack               | `npx tsx examples/queues/send-receive.ts`      |
| [ack-reject.ts](queues/ack-reject.ts)               | Message acknowledgment, rejection, and requeue      | `npx tsx examples/queues/ack-reject.ts`        |
| [dead-letter-queue.ts](queues/dead-letter-queue.ts) | Dead-letter queue with maxReceiveCount              | `npx tsx examples/queues/dead-letter-queue.ts` |
| [delayed-messages.ts](queues/delayed-messages.ts)   | Delayed message delivery                            | `npx tsx examples/queues/delayed-messages.ts`  |
| [peek-messages.ts](queues/peek-messages.ts)         | Peek at waiting messages without consuming          | `npx tsx examples/queues/peek-messages.ts`     |
| [batch-send.ts](queues/batch-send.ts)               | Batch message sending with partial failure handling | `npx tsx examples/queues/batch-send.ts`        |

## Queue Streams

Stream-based queue operations for high-throughput scenarios.

| Example                                                      | Description                             | Run                                                    |
| ------------------------------------------------------------ | --------------------------------------- | ------------------------------------------------------ |
| [stream-send.ts](queues-stream/stream-send.ts)               | High-throughput sending via gRPC stream | `npx tsx examples/queues-stream/stream-send.ts`        |
| [stream-receive.ts](queues-stream/stream-receive.ts)         | Receive with ack/reject per message     | `npx tsx examples/queues-stream/stream-receive.ts`     |
| [visibility-timeout.ts](queues-stream/visibility-timeout.ts) | Visibility timeout handling             | `npx tsx examples/queues-stream/visibility-timeout.ts` |

## RPC (Commands & Queries)

Request/reply patterns for synchronous communication between services.

| Example                                    | Description                               | Run                                      |
| ------------------------------------------ | ----------------------------------------- | ---------------------------------------- |
| [send-command.ts](rpc/send-command.ts)     | Send a command and check execution result | `npx tsx examples/rpc/send-command.ts`   |
| [handle-command.ts](rpc/handle-command.ts) | Subscribe to and handle incoming commands | `npx tsx examples/rpc/handle-command.ts` |
| [send-query.ts](rpc/send-query.ts)         | Send a query and receive data response    | `npx tsx examples/rpc/send-query.ts`     |
| [handle-query.ts](rpc/handle-query.ts)     | Subscribe to and handle incoming queries  | `npx tsx examples/rpc/handle-query.ts`   |
| [cached-query.ts](rpc/cached-query.ts)     | Query with server-side response caching   | `npx tsx examples/rpc/cached-query.ts`   |

## Configuration

Client setup options for authentication, TLS, timeouts, and logging.

| Example                                                | Description                          | Run                                                 |
| ------------------------------------------------------ | ------------------------------------ | --------------------------------------------------- |
| [tls-setup.ts](configuration/tls-setup.ts)             | TLS connection setup                 | `npx tsx examples/configuration/tls-setup.ts`       |
| [mtls-setup.ts](configuration/mtls-setup.ts)           | Mutual TLS (mTLS) setup              | `npx tsx examples/configuration/mtls-setup.ts`      |
| [token-auth.ts](configuration/token-auth.ts)           | Token authentication                 | `npx tsx examples/configuration/token-auth.ts`      |
| [custom-timeouts.ts](configuration/custom-timeouts.ts) | Custom timeout and AbortSignal usage | `npx tsx examples/configuration/custom-timeouts.ts` |
| [custom-logger.ts](configuration/custom-logger.ts)     | Custom logger integration            | `npx tsx examples/configuration/custom-logger.ts`   |

## Observability

Tracing and monitoring integration.

| Example                                                        | Description                            | Run                                                     |
| -------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------- |
| [opentelemetry-setup.ts](observability/opentelemetry-setup.ts) | OpenTelemetry tracing with OTLP export | `npx tsx examples/observability/opentelemetry-setup.ts` |
