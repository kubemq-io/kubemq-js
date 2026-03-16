# Request-Reply with Commands in KubeMQ JS/TypeScript SDK

In this tutorial, you'll build a command-and-response system using KubeMQ's `KubeMQClient`. Commands are different from events and queues — the sender *awaits* until the handler responds, giving you synchronous confirmation that an action was executed.

## What You'll Build

A device-control system where a controller sends commands to restart services and the handler confirms execution. This pattern is ideal for operations where you need to know the outcome before proceeding.

## Prerequisites

- **Node.js 18+** installed (`node --version`)
- **KubeMQ server** running on `localhost:50000` ([quickstart guide](https://docs.kubemq.io/getting-started/quick-start))

Initialize a project and install the SDK:

```bash
mkdir device-controller && cd device-controller
npm init -y
npm install kubemq-js
npm install -D typescript tsx
```

## Step 1 — Connect to KubeMQ

```typescript
import { KubeMQClient, createCommand, KubeMQTimeoutError, ConnectionError } from 'kubemq-js';

async function main(): Promise<void> {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'device-controller',
  });

  console.log('Connected to KubeMQ server');

  const channel = 'devices.commands';

  try {
```

## Step 2 — Register the Command Handler

The handler subscribes to a channel and processes incoming commands. The `onCommand` callback is async — you can perform I/O before responding. Every command must receive a response before the sender's timeout expires.

```typescript
    const subscription = client.subscribeToCommands({
      channel,
      onCommand: async (cmd) => {
        const body = new TextDecoder().decode(cmd.body);
        console.log(`\n[Handler] Received command: ${body}`);

        if (cmd.tags) {
          const tagStr = Object.entries(cmd.tags)
            .map(([k, v]) => `${k}=${v}`)
            .join(', ');
          console.log(`  Tags: ${tagStr}`);
        }

        const success = executeCommand(body);

        await client.sendCommandResponse({
          id: cmd.id,
          replyChannel: cmd.replyChannel,
          executed: success,
          error: success ? undefined : `Unknown command: ${body}`,
        });

        console.log(`  [Handler] Response sent: executed=${success}`);
      },
      onError: (err) => {
        console.error('[Handler] Error:', err.message);
      },
    });

    console.log(`Command handler listening on "${channel}"...`);
```

The `cmd.id` and `cmd.replyChannel` link the response back to the correct sender — KubeMQ uses this correlation to route replies. Without them, the sender would time out waiting.

## Step 3 — Send Commands and Await Responses

Each command includes a `timeoutMs` — if the handler doesn't respond within that window, the promise rejects with a `KubeMQTimeoutError`. This prevents your code from hanging indefinitely.

```typescript
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const commands = ['restart-web-server', 'clear-cache', 'UNKNOWN_ACTION'];

    for (const action of commands) {
      console.log(`\n[Controller] Sending command: ${action}`);

      try {
        const response = await client.sendCommand(
          createCommand({
            channel,
            body: JSON.stringify({ action }),
            timeoutMs: 10000,
            tags: { action, operator: 'admin' },
          }),
        );

        if (response.executed) {
          console.log('[Controller] Command executed successfully');
        } else {
          console.log(`[Controller] Command failed: ${response.error}`);
        }
      } catch (err) {
        if (err instanceof KubeMQTimeoutError) {
          console.log('[Controller] Command timed out — no handler responded');
        } else if (err instanceof ConnectionError) {
          console.log(`[Controller] Connection error: ${(err as ConnectionError).message}`);
        } else {
          console.log(`[Controller] Unexpected error: ${err}`);
        }
      }
    }
```

We deliberately include `UNKNOWN_ACTION` to show how the handler can reject commands it doesn't understand. The sender sees the failure immediately through the response — no exception, just `executed: false`.

## Step 4 — Clean Up

```typescript
    await new Promise((resolve) => setTimeout(resolve, 1000));

    subscription.cancel();
    console.log('\nDevice controller shut down.');
  } finally {
    await client.close();
  }
}

function executeCommand(command: string): boolean {
  switch (command) {
    case 'restart-web-server':
    case 'clear-cache':
      return true;
    default:
      return false;
  }
}

main().catch(console.error);
```

## Complete Program

```typescript
import { KubeMQClient, createCommand, KubeMQTimeoutError, ConnectionError } from 'kubemq-js';

async function main(): Promise<void> {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'device-controller',
  });

  console.log('Connected to KubeMQ server');

  const channel = 'devices.commands';

  try {
    const subscription = client.subscribeToCommands({
      channel,
      onCommand: async (cmd) => {
        const body = new TextDecoder().decode(cmd.body);
        console.log(`\n[Handler] Received command: ${body}`);

        if (cmd.tags) {
          const tagStr = Object.entries(cmd.tags)
            .map(([k, v]) => `${k}=${v}`)
            .join(', ');
          console.log(`  Tags: ${tagStr}`);
        }

        const success = executeCommand(body);

        await client.sendCommandResponse({
          id: cmd.id,
          replyChannel: cmd.replyChannel,
          executed: success,
          error: success ? undefined : `Unknown command: ${body}`,
        });

        console.log(`  [Handler] Response sent: executed=${success}`);
      },
      onError: (err) => {
        console.error('[Handler] Error:', err.message);
      },
    });

    console.log(`Command handler listening on "${channel}"...`);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const commands = ['restart-web-server', 'clear-cache', 'UNKNOWN_ACTION'];

    for (const action of commands) {
      console.log(`\n[Controller] Sending command: ${action}`);

      try {
        const response = await client.sendCommand(
          createCommand({
            channel,
            body: JSON.stringify({ action }),
            timeoutMs: 10000,
            tags: { action, operator: 'admin' },
          }),
        );

        if (response.executed) {
          console.log('[Controller] Command executed successfully');
        } else {
          console.log(`[Controller] Command failed: ${response.error}`);
        }
      } catch (err) {
        if (err instanceof KubeMQTimeoutError) {
          console.log('[Controller] Command timed out — no handler responded');
        } else if (err instanceof ConnectionError) {
          console.log(`[Controller] Connection error: ${(err as ConnectionError).message}`);
        } else {
          console.log(`[Controller] Unexpected error: ${err}`);
        }
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));

    subscription.cancel();
    console.log('\nDevice controller shut down.');
  } finally {
    await client.close();
  }
}

function executeCommand(command: string): boolean {
  switch (command) {
    case 'restart-web-server':
    case 'clear-cache':
      return true;
    default:
      return false;
  }
}

main().catch(console.error);
```

Run with:

```bash
npx tsx device-controller.ts
```

## Expected Output

```
Connected to KubeMQ server
Command handler listening on "devices.commands"...

[Controller] Sending command: restart-web-server

[Handler] Received command: {"action":"restart-web-server"}
  Tags: action=restart-web-server, operator=admin
  [Handler] Response sent: executed=true
[Controller] Command executed successfully

[Controller] Sending command: clear-cache

[Handler] Received command: {"action":"clear-cache"}
  Tags: action=clear-cache, operator=admin
  [Handler] Response sent: executed=true
[Controller] Command executed successfully

[Controller] Sending command: UNKNOWN_ACTION

[Handler] Received command: {"action":"UNKNOWN_ACTION"}
  Tags: action=UNKNOWN_ACTION, operator=admin
  [Handler] Response sent: executed=false
[Controller] Command failed: Unknown command: {"action":"UNKNOWN_ACTION"}

Device controller shut down.
```

## Error Handling

| Error | Cause | Fix |
|-------|-------|-----|
| `KubeMQTimeoutError` | No handler responded in time | Increase `timeoutMs` or verify handler is running |
| `ConnectionError` | Server unreachable or connection dropped | Check server status; recreate client |
| `Handler never responds` | Exception in `onCommand` before `sendCommandResponse` | Wrap handler logic in try-catch |

The most critical rule: **always send a response from the handler**. If your `onCommand` throws before calling `sendCommandResponse`, the sender blocks until timeout. Wrap your handler logic defensively:

```typescript
onCommand: async (cmd) => {
  try {
    const result = await processCommand(cmd);
    await client.sendCommandResponse({
      id: cmd.id,
      replyChannel: cmd.replyChannel,
      executed: result,
    });
  } catch (err) {
    await client.sendCommandResponse({
      id: cmd.id,
      replyChannel: cmd.replyChannel,
      executed: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
},
```

## Next Steps

- **[Getting Started with Events](getting-started-events.md)** — fire-and-forget real-time messaging
- **[Building a Task Queue](building-a-task-queue.md)** — guaranteed delivery with acknowledgment
- **Queries** — like commands, but the response carries a data payload
- **Consumer Groups** — load-balance commands across multiple handlers
