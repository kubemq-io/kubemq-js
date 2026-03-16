import type { Logger } from '../../logger.js';

type OtelApi = typeof import('@opentelemetry/api');
type Context = import('@opentelemetry/api').Context;
type Link = import('@opentelemetry/api').Link;

/**
 * TextMapCarrier adapter over KubeMQ message tags.
 * KubeMQ tags are Map<string, string> — compatible with W3C Trace Context.
 */
export class TagsCarrier {
  constructor(private readonly tags: ReadonlyMap<string, string> | Map<string, string>) {}

  get(key: string): string | undefined {
    return this.tags.get(key);
  }

  set(key: string, value: string): void {
    (this.tags as Map<string, string>).set(key, value);
  }

  keys(): string[] {
    return Array.from(this.tags.keys());
  }
}

const tagsGetter = {
  get(carrier: TagsCarrier, key: string): string | undefined {
    return carrier.get(key);
  },
  keys(carrier: TagsCarrier): string[] {
    return carrier.keys();
  },
};

const tagsSetter = {
  set(carrier: TagsCarrier, key: string, value: string): void {
    carrier.set(key, value);
  },
};

export class TracePropagation {
  constructor(
    private readonly api: OtelApi | undefined,
    private readonly logger: Logger,
  ) {}

  get isEnabled(): boolean {
    return this.api !== undefined;
  }

  /**
   * Inject current trace context into message tags (producer side).
   * Injects `traceparent` and `tracestate` as tag entries.
   */
  inject(tags: Map<string, string>, context?: Context): void {
    if (!this.api) return;

    const carrier = new TagsCarrier(tags);
    const ctx = context ?? this.api.context.active();
    this.api.propagation.inject(ctx, carrier, tagsSetter);
  }

  /**
   * Extract trace context from message tags (consumer side).
   * Accepts ReadonlyMap since extraction is read-only.
   */
  extract(tags: ReadonlyMap<string, string>): Context | undefined {
    if (!this.api) return undefined;

    const carrier = new TagsCarrier(tags);
    try {
      return this.api.propagation.extract(this.api.ROOT_CONTEXT, carrier, tagsGetter);
    } catch {
      this.logger.debug('Failed to extract trace context from message tags — creating root span');
      return undefined;
    }
  }

  /**
   * Create a span link from extracted trace context.
   * Used for producer-consumer correlation (linked, not parented).
   */
  createLink(extractedContext: Context): Link | undefined {
    if (!this.api) return undefined;

    const spanContext = this.api.trace.getSpanContext(extractedContext);
    if (!spanContext || !this.api.isSpanContextValid(spanContext)) return undefined;

    return { context: spanContext };
  }

  /**
   * Extract and create links for batch messages (cap at 128 links).
   */
  createBatchLinks(messages: { tags: Map<string, string> }[]): Link[] {
    if (!this.api) return [];

    const links: Link[] = [];
    const maxLinks = 128;

    for (const msg of messages) {
      if (links.length >= maxLinks) break;
      const ctx = this.extract(msg.tags);
      if (ctx) {
        const link = this.createLink(ctx);
        if (link) links.push(link);
      }
    }

    return links;
  }
}
