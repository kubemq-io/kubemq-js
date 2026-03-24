/**
 * HTTP server v2: all REST API endpoints per burn-in spec v2.1.
 * Supports v2 patterns config, v1 detection/rejection, 202 for start.
 */
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { registry } from './metrics.js';
import type { Engine, RunState } from './engine.js';
import type { Config } from './config.js';
import { translateApiConfig, validateRunConfig, detectV1Format } from './config.js';

export class BurninHttpServer {
  private server: Server;
  private engine: Engine;
  private startupCfg: Config;
  private corsOrigins: string;
  private deprecationWarned = new Set<string>();

  constructor(port: number, engine: Engine, startupCfg: Config) {
    this.engine = engine;
    this.startupCfg = startupCfg;
    this.corsOrigins = startupCfg.cors_origins || '*';
    this.server = createServer((req, res) => this.handle(req, res));
    this.server.listen(port, '0.0.0.0');
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => this.server.close(() => resolve()));
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const method = req.method ?? 'GET';
    const path = (req.url ?? '/').split('?')[0];

    if (method === 'OPTIONS') {
      this.setCors(res);
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      if (method === 'GET') {
        await this.handleGet(path, res);
      } else if (method === 'POST') {
        const body = await this.readBody(req);
        await this.handlePost(path, body, res);
      } else {
        this.jsonResponse(res, 405, { message: 'Method not allowed' });
      }
    } catch (e) {
      this.jsonResponse(res, 500, {
        message: `Internal server error: ${e instanceof Error ? e.message : e}`,
      });
    }
  }

  private async handleGet(path: string, res: ServerResponse): Promise<void> {
    switch (path) {
      case '/health':
        this.jsonResponse(res, 200, { status: 'alive' });
        break;

      case '/ready': {
        const state = this.engine.state;
        const notReady = state === 'starting' || state === 'stopping';
        this.jsonResponse(res, notReady ? 503 : 200, {
          status: notReady ? 'not_ready' : 'ready',
          state,
        });
        break;
      }

      case '/info':
        this.jsonResponse(res, 200, this.engine.getInfo());
        break;

      case '/broker/status': {
        const result = await this.engine.pingBroker();
        this.jsonResponse(res, 200, result);
        break;
      }

      case '/run':
        this.jsonResponse(res, 200, this.engine.buildRunResponse());
        break;

      case '/run/status':
        this.jsonResponse(res, 200, this.engine.buildRunStatus());
        break;

      case '/run/config': {
        const cfg = this.engine.buildRunConfigResponse();
        if (cfg) this.jsonResponse(res, 200, cfg);
        else this.jsonResponse(res, 404, { message: 'No run configuration available' });
        break;
      }

      case '/run/report': {
        const report = this.engine.buildRunReport();
        if (report) {
          // Remove internal _channel_details before returning via API
          const cleaned = JSON.parse(JSON.stringify(report));
          if (cleaned.patterns) {
            for (const ps of Object.values(cleaned.patterns) as any[]) {
              delete ps._channel_details;
            }
          }
          this.jsonResponse(res, 200, cleaned);
        } else {
          this.jsonResponse(res, 404, { message: 'No completed run report available' });
        }
        break;
      }

      case '/metrics': {
        const metrics = await registry.metrics();
        this.setCors(res);
        res.writeHead(200, { 'Content-Type': registry.contentType });
        res.end(metrics);
        break;
      }

      case '/status': {
        this.logDeprecation('/status', '/run/status');
        this.jsonResponse(res, 200, this.engine.buildRunStatus());
        break;
      }

      case '/summary': {
        this.logDeprecation('/summary', '/run/report');
        const report = this.engine.buildRunReport();
        if (report) {
          const cleaned = JSON.parse(JSON.stringify(report));
          if (cleaned.patterns) {
            for (const ps of Object.values(cleaned.patterns) as any[]) {
              delete ps._channel_details;
            }
          }
          this.jsonResponse(res, 200, cleaned);
        } else {
          this.jsonResponse(res, 404, { message: 'No completed run report available' });
        }
        break;
      }

      default:
        this.jsonResponse(res, 404, { message: 'Not found' });
    }
  }

  private async handlePost(path: string, body: string, res: ServerResponse): Promise<void> {
    switch (path) {
      case '/run/start':
        await this.handleRunStart(body, res);
        break;

      case '/run/stop':
        this.handleRunStop(res);
        break;

      case '/cleanup':
        await this.handleCleanup(res);
        break;

      default:
        this.jsonResponse(res, 404, { message: 'Not found' });
    }
  }

  private async handleRunStart(body: string, res: ServerResponse): Promise<void> {
    const state = this.engine.state;
    if (!['idle', 'stopped', 'error'].includes(state)) {
      this.jsonResponse(res, 409, {
        message: 'Run already active',
        run_id: this.engine.runId,
        state,
        started_at: this.engine.startedAt,
      });
      return;
    }

    let apiConfig: Record<string, any>;
    try {
      apiConfig = body ? JSON.parse(body) : {};
    } catch (e) {
      this.jsonResponse(res, 400, {
        message: `Invalid JSON: ${e instanceof Error ? e.message : e}`,
      });
      return;
    }

    // v1 format detection -- dual-layer
    const v1Check = detectV1Format(apiConfig);
    if (v1Check.isV1) {
      this.jsonResponse(res, 400, {
        message: 'v1 config format not supported. Update to v2 patterns format.',
        errors: v1Check.errors,
      });
      return;
    }

    let runCfg: Config;
    try {
      runCfg = translateApiConfig(apiConfig, this.startupCfg);
    } catch (e) {
      this.jsonResponse(res, 400, {
        message: `Config translation error: ${e instanceof Error ? e.message : e}`,
      });
      return;
    }

    const errors = validateRunConfig(runCfg);
    if (errors.length > 0) {
      this.jsonResponse(res, 400, { message: 'Configuration validation failed', errors });
      return;
    }

    // Count total channels and enabled patterns
    let totalChannels = 0;
    let enabledCount = 0;
    for (const pc of Object.values(runCfg.patterns)) {
      if (pc.enabled) {
        enabledCount++;
        totalChannels += pc.channels;
      }
    }

    this.engine.startRun(runCfg);

    this.jsonResponse(res, 202, {
      status: 'starting',
      run_id: runCfg.run_id,
      message: `run starting with ${totalChannels} channels across ${enabledCount} patterns`,
    });
  }

  private handleRunStop(res: ServerResponse): void {
    const state = this.engine.state;

    if (state === 'stopping') {
      this.jsonResponse(res, 409, {
        message: 'Run is already stopping',
        run_id: this.engine.runId,
        state: 'stopping',
      });
      return;
    }

    if (!['starting', 'running'].includes(state)) {
      this.jsonResponse(res, 409, {
        message: 'No active run to stop',
        state,
      });
      return;
    }

    this.engine.requestStop();
    this.jsonResponse(res, 202, {
      run_id: this.engine.runId,
      state: 'stopping',
      message: 'Graceful shutdown initiated',
    });
  }

  private async handleCleanup(res: ServerResponse): Promise<void> {
    const state = this.engine.state;
    if (['starting', 'running', 'stopping'].includes(state)) {
      this.jsonResponse(res, 409, {
        message: 'Cannot cleanup while a run is active',
        state,
        run_id: this.engine.runId,
      });
      return;
    }

    const result = await this.engine.cleanupChannels();
    this.jsonResponse(res, 200, result);
  }

  private logDeprecation(oldPath: string, newPath: string): void {
    if (!this.deprecationWarned.has(oldPath)) {
      this.deprecationWarned.add(oldPath);
      console.warn(`DEPRECATION: ${oldPath} is deprecated, use ${newPath} instead`);
    }
  }

  private async readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      req.on('error', reject);
    });
  }

  private setCors(res: ServerResponse): void {
    res.setHeader('Access-Control-Allow-Origin', this.corsOrigins);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  private jsonResponse(res: ServerResponse, code: number, data: unknown): void {
    const body = JSON.stringify(data);
    this.setCors(res);
    res.writeHead(code, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    });
    res.end(body);
  }
}
