/**
 * Example: OpenTelemetry Tracing Setup
 *
 * Demonstrates integrating OpenTelemetry tracing with the KubeMQ SDK.
 * When a TracerProvider is configured, the SDK automatically creates
 * spans for all operations and propagates W3C Trace Context headers.
 *
 * Prerequisites:
 *   - KubeMQ server running on localhost:50000
 *   - OpenTelemetry dependencies installed:
 *     npm install @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/exporter-trace-otlp-grpc
 *
 * Run: npx tsx examples/observability/opentelemetry-setup.ts
 */
import { KubeMQClient, createEventMessage } from '../../src/index.js';

// In a real application, set up the OTel SDK before creating the KubeMQ client:
//
//   import { NodeSDK } from '@opentelemetry/sdk-node';
//   import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
//
//   const sdk = new NodeSDK({
//     traceExporter: new OTLPTraceExporter({ url: 'http://localhost:4317' }),
//     serviceName: 'my-service',
//   });
//   sdk.start();

async function main(): Promise<void> {
  // Pass the tracerProvider to enable automatic span creation.
  // The SDK creates spans for: sendEvent, sendQueueMessage, sendCommand,
  // sendQuery, subscribeToEvents, and all other client operations.
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-observability-opentelemetry-setup-client',
    // tracerProvider: trace.getTracerProvider(),  // Uncomment with real OTel setup
  });

  try {
    // This operation will create a span named "kubemq.sendEvent"
    // with attributes: messaging.system, messaging.destination, etc.
    await client.sendEvent(
      createEventMessage({
        channel: 'js-observability.opentelemetry-setup',
        body: JSON.stringify({ orderId: 'ORD-001', total: 99.99 }),
        tags: { source: 'checkout-service' },
      }),
    );

    console.log('Event published with OTel tracing enabled');
    console.log('Check your OTel collector/backend for the trace');
  } finally {
    await client.close();
  }
}

main().catch(console.error);
