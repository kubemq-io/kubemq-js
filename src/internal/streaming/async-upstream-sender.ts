/**
 * @internal — Shared bidi streaming sender for queue upstream messages.
 *
 * Single persistent QueuesUpstream stream per client. All channels share one stream.
 * Mirrors Python SDK's AsyncUpstreamSender architecture.
 */
import { BaseStreamingSender } from './base-streaming-sender.js';
import type { BaseSenderOptions } from './base-streaming-sender.js';
import type { kubemq } from '../../protos/kubemq.js';

export interface AsyncUpstreamSenderOptions extends BaseSenderOptions {
  /** Default send timeout in ms if no per-call deadline is provided. Default: 2000. */
  sendTimeoutMs?: number;
}

export class AsyncUpstreamSender extends BaseStreamingSender<
  kubemq.QueuesUpstreamRequest,
  kubemq.QueuesUpstreamResponse,
  string
> {
  private readonly sendTimeoutMs: number;

  constructor(opts: AsyncUpstreamSenderOptions) {
    super(opts);
    this.sendTimeoutMs = opts.sendTimeoutMs ?? 2000;
  }

  protected grpcMethod(): string {
    return 'QueuesUpstream';
  }

  protected extractRequestKey(request: kubemq.QueuesUpstreamRequest): string | null {
    return request.RequestID || null;
  }

  protected extractResponseKey(response: kubemq.QueuesUpstreamResponse): string | null {
    return response.RefRequestID || null;
  }

  protected isResponseSuccess(response: kubemq.QueuesUpstreamResponse): boolean {
    return !response.IsError;
  }

  protected responseErrorMessage(response: kubemq.QueuesUpstreamResponse): string {
    return response.Error || 'Queue upstream send failed';
  }

  /**
   * Send queue messages via the shared upstream stream.
   * Returns a Promise that resolves when the server ACKs.
   */
  send(
    request: kubemq.QueuesUpstreamRequest,
    deadline?: Date,
  ): Promise<kubemq.QueuesUpstreamResponse> {
    const effectiveDeadline = deadline ?? new Date(Date.now() + this.sendTimeoutMs);
    const p = this.enqueue(request, true, effectiveDeadline);
    if (!p) throw new Error('unreachable: tracked enqueue returned undefined');
    return p;
  }
}
