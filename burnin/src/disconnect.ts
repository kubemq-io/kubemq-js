/**
 * Forced disconnect manager: close client, wait, recreate.
 */
import * as mc from './metrics.js';

export interface ClientRecreator {
  closeClient(): Promise<void>;
  recreateClient(): Promise<void>;
}

export class DisconnectManager {
  private intervalSec: number;
  private durationSec: number;
  private recreator: ClientRecreator;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(intervalSec: number, durationSec: number, recreator: ClientRecreator) {
    this.intervalSec = intervalSec;
    this.durationSec = durationSec;
    this.recreator = recreator;
  }

  get enabled(): boolean {
    return this.intervalSec > 0;
  }

  start(): void {
    if (!this.enabled) return;
    this.schedule();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  private schedule(): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => this.disconnect(), this.intervalSec * 1000);
  }

  private async disconnect(): Promise<void> {
    if (this.stopped) return;
    console.log('forced disconnect: closing client');
    mc.incForcedDisconnects();
    try {
      await this.recreator.closeClient();
    } catch (e) {
      console.error('disconnect close error:', e);
    }
    await this.delay(this.durationSec * 1000);
    if (this.stopped) return;
    console.log('forced disconnect: recreating client');
    try {
      await this.recreator.recreateClient();
    } catch (e) {
      console.error('disconnect recreate error:', e);
    }
    this.schedule();
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
