/**
 * Example: Fan-Out Pattern
 *
 * Demonstrates one publisher sending events to multiple independent
 * subscribers. Each subscriber receives a copy of every published event.
 * This is the default behavior for events (no consumer group).
 *
 * Prerequisites:
 *   - KubeMQ server running on localhost:50000
 *
 * Run: npx tsx examples/patterns/fan-out.ts
 */
import { KubeMQClient, createEventMessage } from '../../src/index.js';

async function main(): Promise<void> {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-patterns-fan-out-client',
  });

  try {
    // Create three independent subscribers — each receives all events.
    const logger = client.subscribeToEvents({
      channel: 'js-patterns.fan-out',
      onMessage: (event) => {
        console.log('[Logger]', new TextDecoder().decode(event.body));
      },
      onError: (err) => {
        console.error('Logger error:', err.message);
      },
    });

    const monitor = client.subscribeToEvents({
      channel: 'js-patterns.fan-out',
      onMessage: (event) => {
        console.log('[Monitor]', new TextDecoder().decode(event.body));
      },
      onError: (err) => {
        console.error('Monitor error:', err.message);
      },
    });

    const alerter = client.subscribeToEvents({
      channel: 'js-patterns.fan-out',
      onMessage: (event) => {
        const body = new TextDecoder().decode(event.body);
        if (body.includes('critical')) {
          console.log('[Alerter] ALERT:', body);
        } else {
          console.log('[Alerter] (ignored non-critical):', body);
        }
      },
      onError: (err) => {
        console.error('Alerter error:', err.message);
      },
    });

    // Publish events — all three subscribers receive each one.
    const events = [
      'cpu_usage=45% status=normal',
      'cpu_usage=92% status=critical',
      'disk_io=120MB/s status=normal',
    ];

    for (const data of events) {
      await client.publishEvent(
        createEventMessage({
          channel: 'js-patterns.fan-out',
          body: data,
          tags: { source: 'system-monitor' },
        }),
      );
    }

    console.log(`\nPublished ${events.length} events to 3 subscribers`);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    logger.cancel();
    monitor.cancel();
    alerter.cancel();
  } finally {
    await client.close();
  }
}

main().catch(console.error);
