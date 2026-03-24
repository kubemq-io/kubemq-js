# How To: Monitor with OpenTelemetry

Instrument KubeMQ operations with distributed tracing and metrics using OpenTelemetry.

## How It Works

Pass `tracerProvider` and/or `meterProvider` to `KubeMQClient.create()`. The SDK creates spans for every operation (publish, send, subscribe, receive) and records metrics. When no provider is passed, instrumentation is a zero-cost no-op.

## Dependencies

```bash
npm install @opentelemetry/api @opentelemetry/sdk-node \
  @opentelemetry/exporter-trace-otlp-grpc \
  @opentelemetry/exporter-metrics-otlp-grpc
```

## Tracing Setup

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { trace } from '@opentelemetry/api';
import { KubeMQClient, createEventMessage } from 'kubemq-js';

// 1. Initialize OTel SDK before creating the KubeMQ client
const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({ url: 'http://localhost:4317' }),
  serviceName: 'order-service',
});
sdk.start();

// 2. Pass the tracer provider to the client
const client = await KubeMQClient.create({
  address: 'localhost:50000',
  clientId: 'traced-service',
  tracerProvider: trace.getTracerProvider(),
});

// 3. Operations produce spans automatically
await client.sendEvent(
  createEventMessage({
    channel: 'orders.created',
    body: JSON.stringify({ orderId: 'ORD-001', total: 99.99 }),
    tags: { source: 'checkout-service' },
  }),
);

console.log('Event published — check your OTel collector for traces');

await client.close();
await sdk.shutdown();
```

## Metrics Setup

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { metrics } from '@opentelemetry/api';
import { KubeMQClient } from 'kubemq-js';

const sdk = new NodeSDK({
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({ url: 'http://localhost:4317' }),
    exportIntervalMillis: 15_000,
  }),
  serviceName: 'order-service',
});
sdk.start();

const client = await KubeMQClient.create({
  address: 'localhost:50000',
  meterProvider: metrics.getMeterProvider(),
});
```

## Span Attributes

Every SDK span includes these semantic attributes:

| Attribute                    | Example                                 |
| ---------------------------- | --------------------------------------- |
| `messaging.system`           | `kubemq`                                |
| `messaging.operation.name`   | `publish`, `receive`, `send`, `process` |
| `messaging.destination.name` | `orders.created`                        |
| `messaging.client.id`        | `traced-service`                        |
| `messaging.message.id`       | `<uuid>`                                |
| `server.address`             | `localhost`                             |
| `server.port`                | `50000`                                 |

## Metrics Emitted

| Metric                      | Type      | Description                           |
| --------------------------- | --------- | ------------------------------------- |
| `kubemq.messages.sent`      | Counter   | Messages published/sent               |
| `kubemq.messages.consumed`  | Counter   | Messages received                     |
| `kubemq.operation.duration` | Histogram | Operation latency (seconds)           |
| `kubemq.connection.changes` | Counter   | Connection state transitions          |
| `kubemq.retry.attempts`     | Counter   | Retry attempts                        |
| `kubemq.retry.exhausted`    | Counter   | Operations that exhausted all retries |

## Custom Parent Spans

Wrap KubeMQ operations in business-context spans:

```typescript
import { trace } from '@opentelemetry/api';
import { KubeMQClient, createEventMessage } from 'kubemq-js';

const tracer = trace.getTracer('my-service');
const client = await KubeMQClient.create({
  address: 'localhost:50000',
  tracerProvider: trace.getTracerProvider(),
});

await tracer.startActiveSpan('processOrder', async (span) => {
  try {
    // KubeMQ spans are automatically children of the active span
    await client.sendEvent(
      createEventMessage({
        channel: 'orders.created',
        body: JSON.stringify({ orderId: 'ORD-002' }),
      }),
    );

    await client.sendQueueMessage({
      channel: 'queues.fulfillment',
      body: new TextEncoder().encode('fulfill ORD-002'),
    });
  } finally {
    span.end();
  }
});

await client.close();
```

## Troubleshooting

| Symptom                       | Cause                                  | Fix                                                    |
| ----------------------------- | -------------------------------------- | ------------------------------------------------------ |
| No spans in collector         | `tracerProvider` not passed to client  | Pass `trace.getTracerProvider()` in `create()`         |
| Spans appear but not exported | Exporter misconfigured                 | Verify OTel collector URL and protocol                 |
| Missing parent-child links    | OTel SDK started after client creation | Initialize OTel SDK **before** `KubeMQClient.create()` |
| Metrics not appearing         | `meterProvider` not passed             | Pass `metrics.getMeterProvider()` in `create()`        |
| High memory from metrics      | Too many unique label combos           | Use structured channel naming to reduce cardinality    |
