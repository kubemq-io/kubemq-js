/**
 * CLI entry point: boots into idle state with HTTP server ready.
 * Supports --validate-config, --cleanup-only CLI modes.
 * Normal mode: HTTP API controls run lifecycle (POST /run/start).
 */
import { parseArgs } from 'node:util';
import { loadConfig, validateConfig } from './config.js';
import { Engine, cleanupOnly } from './engine.js';
import { BurninHttpServer } from './httpServer.js';
import { preInitializeMetrics } from './metrics.js';

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      config: { type: 'string', short: 'c', default: '' },
      'validate-config': { type: 'boolean', default: false },
      'cleanup-only': { type: 'boolean', default: false },
    },
    strict: false,
  });

  const { config: cfg, warnings } = loadConfig((values.config as string) ?? '');
  for (const w of warnings) console.warn(`WARNING: ${w}`);

  const errors = validateConfig(cfg);
  let hasErrors = false;
  for (const e of errors) {
    if (e.startsWith('WARNING')) console.warn(e);
    else {
      console.error(`config error: ${e}`);
      hasErrors = true;
    }
  }
  if (hasErrors) process.exit(2);

  if (values['validate-config']) {
    console.log('config validation passed');
    console.log(
      `mode=${cfg.mode} duration=${cfg.duration} broker=${cfg.broker.address} run_id=${cfg.run_id}`,
    );
    process.exit(0);
  }

  if (values['cleanup-only']) {
    console.log('running cleanup-only mode');
    try {
      await cleanupOnly(cfg);
      console.log('cleanup complete');
    } catch (e) {
      console.error('cleanup failed:', e);
      process.exit(1);
    }
    process.exit(0);
  }

  process.on('unhandledRejection', (reason) => {
    console.error('unhandled rejection:', reason);
  });

  preInitializeMetrics();

  const engine = new Engine(cfg);
  const srv = new BurninHttpServer(cfg.metrics.port, engine, cfg);
  console.log(`HTTP server started on port ${cfg.metrics.port}`);
  console.log(`burn-in app ready (idle) — waiting for POST /run/start`);

  let shuttingDown = false;
  const onSignal = async (sig: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`received ${sig}, shutting down`);

    const state = engine.state;
    if (state === 'starting' || state === 'running') {
      engine.requestStop();
      const passed = await engine.waitForCompletion();
      await srv.stop();
      process.exit(passed ? 0 : 1);
    } else if (state === 'stopping') {
      await engine.waitForCompletion();
      await srv.stop();
      const report = engine.buildRunReport();
      process.exit(report?.verdict?.result === 'FAILED' ? 1 : 0);
    } else {
      await srv.stop();
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => {
    onSignal('SIGTERM');
  });
  process.on('SIGINT', () => {
    onSignal('SIGINT');
  });
}

main().catch((e) => {
  console.error('fatal:', e);
  process.exit(2);
});
