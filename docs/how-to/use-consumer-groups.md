# How To: Use Consumer Groups

Distribute messages across multiple subscribers using consumer groups for load-balanced processing.

## How Consumer Groups Work

When multiple subscribers join the same `group` on a channel, each message is delivered to **exactly one** subscriber in the group. Without a group, every subscriber receives every message (fan-out).

## Events — Load-Balanced Subscription

```typescript
import { KubeMQClient, createEventMessage } from 'kubemq-js';

const client = await KubeMQClient.create({
  address: 'localhost:50000',
  clientId: 'events-group-demo',
});

const sub1 = client.subscribeToEvents({
  channel: 'orders.created',
  group: 'processors',
  onEvent: (event) => {
    console.log('[Worker A]', new TextDecoder().decode(event.body));
  },
  onError: (err) => console.error('Worker A error:', err.message),
});

const sub2 = client.subscribeToEvents({
  channel: 'orders.created',
  group: 'processors',
  onEvent: (event) => {
    console.log('[Worker B]', new TextDecoder().decode(event.body));
  },
  onError: (err) => console.error('Worker B error:', err.message),
});

for (let i = 1; i <= 6; i++) {
  await client.sendEvent(createEventMessage({ channel: 'orders.created', body: `Order #${i}` }));
}

await new Promise((r) => setTimeout(r, 1000));

sub1.cancel();
sub2.cancel();
await client.close();
```

## Events Store — Persistent with Group

```typescript
import { KubeMQClient, EventStoreStartPosition } from 'kubemq-js';

const client = await KubeMQClient.create({
  address: 'localhost:50000',
  clientId: 'store-group-demo',
});

const sub = client.subscribeToEventsStore({
  channel: 'audit.logs',
  group: 'log-indexers',
  startFrom: EventStoreStartPosition.StartFromFirst,
  onEvent: (event) => {
    console.log(`[Indexer] seq=${event.sequence}`, new TextDecoder().decode(event.body));
  },
  onError: (err) => console.error('Error:', err.message),
});

await client.sendEventStore({
  channel: 'audit.logs',
  body: new TextEncoder().encode('Log entry 1'),
});

await new Promise((r) => setTimeout(r, 2000));
sub.cancel();
await client.close();
```

## Commands — Distributed Command Handlers

```typescript
import { KubeMQClient } from 'kubemq-js';

const client = await KubeMQClient.create({
  address: 'localhost:50000',
  clientId: 'cmd-group-demo',
});

const sub = client.subscribeToCommands({
  channel: 'commands.process',
  group: 'handlers',
  onCommand: (cmd) => {
    console.log('[Handler]', new TextDecoder().decode(cmd.body));
    client.sendCommandResponse({
      requestId: cmd.requestId,
      replyChannel: cmd.replyChannel!,
      executed: true,
    });
  },
  onError: (err) => console.error('Error:', err.message),
});

await new Promise((r) => setTimeout(r, 1000));

const response = await client.sendCommand({
  channel: 'commands.process',
  body: new TextEncoder().encode('do-work'),
  timeoutInSeconds: 5,
});
console.log('Executed:', response.executed);

sub.cancel();
await client.close();
```

## Queries — Distributed Query Handlers

```typescript
import { KubeMQClient } from 'kubemq-js';

const client = await KubeMQClient.create({
  address: 'localhost:50000',
  clientId: 'query-group-demo',
});

const sub = client.subscribeToQueries({
  channel: 'queries.lookup',
  group: 'responders',
  onQuery: (query) => {
    console.log('[Responder]', new TextDecoder().decode(query.body));
    client.sendQueryResponse({
      requestId: query.requestId,
      replyChannel: query.replyChannel!,
      executed: true,
      body: new TextEncoder().encode('{"status":"ok"}'),
    });
  },
  onError: (err) => console.error('Error:', err.message),
});

await new Promise((r) => setTimeout(r, 1000));

const result = await client.sendQuery({
  channel: 'queries.lookup',
  body: new TextEncoder().encode('find-user'),
  timeoutInSeconds: 5,
});
console.log('Response:', new TextDecoder().decode(result.body));

sub.cancel();
await client.close();
```

## Cancelling Group Subscriptions with AbortSignal

```typescript
import { KubeMQClient } from 'kubemq-js';

const client = await KubeMQClient.create({ address: 'localhost:50000' });
const controller = new AbortController();

const sub = client.subscribeToEvents(
  {
    channel: 'events.work',
    group: 'workers',
    onEvent: (event) => console.log('Got:', event.id),
    onError: (err) => console.error(err.message),
  },
  { signal: controller.signal },
);

// Cancel after 30 seconds
setTimeout(() => controller.abort(), 30_000);
```

## Troubleshooting

| Symptom                               | Cause                            | Fix                                                   |
| ------------------------------------- | -------------------------------- | ----------------------------------------------------- |
| All subscribers receive every message | No `group` set                   | Add `group: 'my-group'` to the subscription           |
| One subscriber gets all messages      | Only one subscriber in the group | Scale up by adding more group members                 |
| Messages stop after subscriber crash  | No other group member available  | Run 2+ subscribers per group for HA                   |
| Different groups get the same message | Groups are independent           | This is correct — groups are isolated fan-out targets |
