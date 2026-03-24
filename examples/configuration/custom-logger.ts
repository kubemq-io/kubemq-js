/**
 * Example: Custom Logger Integration
 *
 * Demonstrates injecting a custom logger into the SDK. The SDK is
 * silent by default (uses noopLogger). You can inject any logger that
 * implements the Logger interface, or use the built-in createConsoleLogger.
 *
 * Prerequisites:
 *   - KubeMQ server running on localhost:50000
 *
 * Run: npx tsx examples/configuration/custom-logger.ts
 */
import { KubeMQClient, createConsoleLogger, createEventMessage } from '../../src/index.js';
import type { Logger, LogLevel, LogContext } from '../../src/index.js';

// Option 1: Use the built-in console logger.
async function withConsoleLogger(): Promise<void> {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-configuration-custom-logger-client',
    logger: createConsoleLogger('debug'),
  });

  try {
    await client.sendEvent(
      createEventMessage({
        channel: 'js-configuration.custom-logger',
        body: 'Hello with console logger',
      }),
    );
  } finally {
    await client.close();
  }
}

// Option 2: Implement a custom structured logger.
function createJsonLogger(): Logger {
  const logger: Logger = {
    debug: (message: string, context?: LogContext) => {
      emit('debug', message, context);
    },
    info: (message: string, context?: LogContext) => {
      emit('info', message, context);
    },
    warn: (message: string, context?: LogContext) => {
      emit('warn', message, context);
    },
    error: (message: string, context?: LogContext) => {
      emit('error', message, context);
    },
  };

  function emit(level: LogLevel, message: string, context?: LogContext): void {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context,
    };
    process.stdout.write(JSON.stringify(entry) + '\n');
  }

  return logger;
}

async function withCustomLogger(): Promise<void> {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-configuration-custom-logger-client',
    logger: createJsonLogger(),
  });

  try {
    await client.sendEvent(
      createEventMessage({
        channel: 'js-configuration.custom-logger',
        body: 'Hello with JSON logger',
      }),
    );
  } finally {
    await client.close();
  }
}

async function main(): Promise<void> {
  console.log('=== Console Logger ===');
  await withConsoleLogger();

  console.log('\n=== Custom JSON Logger ===');
  await withCustomLogger();
}

main().catch(console.error);
