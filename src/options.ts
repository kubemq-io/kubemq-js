import type { Logger } from './logger.js';
import type { CredentialProvider } from './auth/credential-provider.js';

/**
 * Jitter strategy applied to retry and reconnection backoff delays.
 *
 * @remarks
 * - `'full'` — Uniform random jitter in `[0, computedDelay]`. Best general-purpose choice.
 * - `'equal'` — Half the computed delay is fixed, the other half is randomized.
 * - `'none'` — No jitter; uses the raw exponential delay. Risk of thundering-herd.
 *
 * @see {@link RetryPolicy}
 * @see {@link ReconnectionPolicy}
 */
export type JitterType = 'full' | 'equal' | 'none';

/**
 * Policy governing automatic retries for failed operations.
 *
 * @remarks
 * Applied to all retriable SDK operations (publish, send, queue send, etc.).
 * The actual delay between retries is computed as
 * `min(initialBackoffMs * multiplier^attempt, maxBackoffMs)`, then jittered
 * according to the {@link JitterType} strategy.
 *
 * @see {@link DEFAULT_RETRY_POLICY}
 * @see {@link ClientOptions.retry}
 */
export interface RetryPolicy {
  /** Maximum number of retry attempts before throwing {@link RetryExhaustedError}. */
  readonly maxRetries: number;
  /** Base delay in milliseconds for the first retry. */
  readonly initialBackoffMs: number;
  /** Upper bound on the computed backoff delay in milliseconds. */
  readonly maxBackoffMs: number;
  /** Exponential multiplier applied to the backoff after each attempt. */
  readonly multiplier: number;
  /** Jitter strategy to reduce retry contention. */
  readonly jitter: JitterType;
}

export const DEFAULT_RETRY_POLICY: Readonly<RetryPolicy> = Object.freeze({
  maxRetries: 3,
  initialBackoffMs: 500,
  maxBackoffMs: 30_000,
  multiplier: 2.0,
  jitter: 'full' as const,
});

export const DEFAULT_KEEPALIVE: Readonly<KeepaliveOptions> = Object.freeze({
  timeMs: 10_000,
  timeoutMs: 5_000,
  permitWithoutCalls: true,
});

export const DEFAULT_RECONNECTION_POLICY: Readonly<ReconnectionPolicy> = Object.freeze({
  maxAttempts: -1,
  initialDelayMs: 500,
  maxDelayMs: 30_000,
  multiplier: 2.0,
  jitter: 'full' as const,
});

export const DEFAULT_CONNECTION_TIMEOUT_MS = 10_000;
export const DEFAULT_MAX_MESSAGE_SIZE = 104_857_600;
export const DEFAULT_RECONNECT_BUFFER_SIZE = 8_388_608;

export const DEFAULT_SEND_TIMEOUT_MS = 5000;
export const DEFAULT_SUBSCRIBE_TIMEOUT_MS = 10_000;
export const DEFAULT_RPC_TIMEOUT_MS = 10_000;
export const DEFAULT_QUEUE_RECEIVE_TIMEOUT_MS = 10_000;
export const DEFAULT_QUEUE_POLL_TIMEOUT_MS = 30_000;
export const DEFAULT_MAX_CONCURRENT_RETRIES = 10;

/**
 * Policy governing automatic reconnection when the gRPC transport disconnects.
 *
 * @remarks
 * When the connection drops, the client enters `RECONNECTING` state and
 * attempts to re-establish the connection using exponential backoff with jitter.
 * Set `maxAttempts` to `-1` for unlimited reconnection attempts.
 *
 * Active subscriptions are automatically re-established after a successful
 * reconnection. Buffered messages (if `reconnectBufferSize > 0`) are replayed.
 *
 * @see {@link DEFAULT_RECONNECTION_POLICY}
 * @see {@link ClientOptions.reconnect}
 * @see {@link ConnectionState}
 */
export interface ReconnectionPolicy {
  /** Maximum reconnection attempts. Use `-1` for unlimited. */
  readonly maxAttempts: number;
  /** Base delay in milliseconds for the first reconnection attempt. */
  readonly initialDelayMs: number;
  /** Upper bound on the computed reconnection delay in milliseconds. */
  readonly maxDelayMs: number;
  /** Exponential multiplier applied to the delay after each attempt. */
  readonly multiplier: number;
  /** Jitter strategy to reduce reconnection contention across clients. */
  readonly jitter: JitterType;
}

/**
 * TLS/SSL configuration for encrypting the gRPC connection.
 *
 * @remarks
 * Set `enabled: true` (or pass `tls: true` in {@link ClientOptions}) for
 * server-authenticated TLS. For mutual TLS (mTLS), also provide `clientCert`
 * and `clientKey`. Certificate values accept PEM-encoded strings or raw Buffers.
 *
 * @see {@link ClientOptions.tls}
 */
export interface TlsOptions {
  /** Whether TLS is enabled. Defaults to `false`. */
  enabled?: boolean;
  /** PEM-encoded CA certificate or bundle for server verification. */
  caCert?: string | Buffer;
  /** PEM-encoded client certificate for mutual TLS. */
  clientCert?: string | Buffer;
  /** PEM-encoded client private key for mutual TLS. */
  clientKey?: string | Buffer;
  /** Override the server name used for certificate verification. */
  serverNameOverride?: string;
  /** Skip server certificate verification. **Insecure — use only for development.** */
  insecureSkipVerify?: boolean;
  /** Minimum TLS version to accept. */
  minVersion?: 'TLSv1.2' | 'TLSv1.3';
}

/**
 * gRPC HTTP/2 keepalive configuration.
 *
 * @remarks
 * Keepalive pings prevent idle connections from being silently dropped
 * by firewalls or load balancers. The defaults are tuned for most
 * cloud environments (10s ping interval, 5s timeout).
 *
 * @see {@link DEFAULT_KEEPALIVE}
 * @see {@link ClientOptions.keepalive}
 */
export interface KeepaliveOptions {
  /** Interval in milliseconds between keepalive pings. */
  readonly timeMs: number;
  /** Time in milliseconds to wait for a keepalive ping response before closing. */
  readonly timeoutMs: number;
  /** Whether to send pings even when there are no active RPCs. */
  readonly permitWithoutCalls: boolean;
}

/**
 * Options for individual async operations.
 *
 * @remarks
 * Pass to any async method on `KubeMQClient` to control cancellation
 * and timeout behavior for that specific operation.
 */
export interface OperationOptions {
  /**
   * AbortSignal for cooperative cancellation.
   * When aborted, the operation is cancelled and throws `CancellationError`.
   *
   * @example
   * ```typescript
   * const controller = new AbortController();
   * setTimeout(() => controller.abort(), 5000);
   * await client.sendEvent(msg, { signal: controller.signal });
   * ```
   */
  signal?: AbortSignal;

  /**
   * Operation timeout in milliseconds.
   * Overrides the client-level default timeout for this operation.
   * When exceeded, throws `KubeMQTimeoutError`.
   */
  timeout?: number;
}

/**
 * Options for subscription operations, extending OperationOptions.
 */
export interface SubscriptionOptions extends OperationOptions {
  /**
   * Maximum number of concurrent callback invocations.
   * Default varies by subscription type: events=100, events_store=20, commands/queries=1.
   * Set to a higher value for parallel message processing.
   *
   * @remarks
   * When > 1, messages are dispatched to the callback concurrently
   * using an internal semaphore. Message ordering is NOT guaranteed
   * when concurrency > 1. Use 1 for ordered processing.
   */
  maxConcurrentCallbacks?: number;

  /**
   * Maximum internal queue depth before backpressure is applied.
   * Default: 1000.
   */
  maxQueueDepth?: number;

  /**
   * If true, drop messages when the internal queue is full instead of
   * pausing the gRPC stream. Useful for pub/sub patterns where message
   * loss is acceptable but stream stalls are not. Default: false.
   */
  dropOnHighWater?: boolean;
}

/**
 * Options for the `close()` method.
 */
export interface CloseOptions {
  /**
   * Max time to wait for in-flight gRPC operations to drain, in seconds.
   * Default: 5.
   */
  timeoutSeconds?: number;

  /**
   * Max time to wait for in-flight subscription callbacks to complete, in seconds.
   * Default: 30.
   *
   * Callbacks that haven't completed within this timeout are abandoned —
   * they may still be running in the background but the client will
   * proceed to close.
   */
  callbackTimeoutSeconds?: number;
}

/**
 * Configuration options for creating a {@link KubeMQClient}.
 *
 * @remarks
 * Only `address` is required. All other options have sensible defaults.
 * Pass to {@link KubeMQClient.create} to build a connected client.
 *
 * @example
 * ```typescript
 * const client = await KubeMQClient.create({
 *   address: 'localhost:50000',
 *   clientId: 'order-service',
 *   logger: createConsoleLogger('info'),
 *   retry: { ...DEFAULT_RETRY_POLICY, maxRetries: 5 },
 * });
 * ```
 *
 * @see {@link KubeMQClient.create}
 */
export interface ClientOptions {
  /** KubeMQ server address in `host:port` format. */
  address: string;
  /** Unique client identifier. Auto-generated UUID if omitted. */
  clientId?: string;
  /** Authentication credentials — a token string or a {@link CredentialProvider}. */
  credentials?: CredentialProvider | string;
  /** TLS configuration. Pass `true` for default TLS, or a {@link TlsOptions} object. */
  tls?: TlsOptions | boolean;
  /** HTTP/2 keepalive settings. Uses {@link DEFAULT_KEEPALIVE} if omitted. */
  keepalive?: KeepaliveOptions;
  /** Retry policy for failed operations. Uses {@link DEFAULT_RETRY_POLICY} if omitted. */
  retry?: RetryPolicy;
  /** Reconnection policy for dropped connections. Uses {@link DEFAULT_RECONNECTION_POLICY} if omitted. */
  reconnect?: ReconnectionPolicy;
  /** Maximum time in seconds to wait for the initial connection. Default: 10. */
  connectionTimeoutSeconds?: number;
  /** Maximum inbound message size in bytes. Default: {@link DEFAULT_MAX_MESSAGE_SIZE} (100 MiB). */
  maxReceiveMessageSize?: number;
  /** Maximum outbound message size in bytes. Default: {@link DEFAULT_MAX_MESSAGE_SIZE} (100 MiB). */
  maxSendMessageSize?: number;
  /** Block until the gRPC channel is ready instead of failing fast. */
  waitForReady?: boolean;
  /** Structured logger implementation. Default: silent no-op logger. */
  logger?: Logger;
  /** OpenTelemetry TracerProvider for distributed tracing. */
  tracerProvider?: unknown;
  /** OpenTelemetry MeterProvider for metrics collection. */
  meterProvider?: unknown;
  /** Size in bytes of the in-memory buffer for messages sent during reconnection. Default: {@link DEFAULT_RECONNECT_BUFFER_SIZE}. */
  reconnectBufferSize?: number;
  /** Behavior when the reconnect buffer is full: `'error'` throws {@link BufferFullError}, `'block'` waits. */
  reconnectBufferMode?: 'error' | 'block';
  /** Maximum number of concurrent retry operations across all calls. Default: {@link DEFAULT_MAX_CONCURRENT_RETRIES}. */
  maxConcurrentRetries?: number;
  /** Default timeout in seconds for publish/send operations. Default: 5. */
  defaultSendTimeoutSeconds?: number;
  /** Default timeout in seconds for subscribe operations. Default: 10. */
  defaultSubscribeTimeoutSeconds?: number;
  /** Default timeout in seconds for RPC (command/query) operations. Default: 10. */
  defaultRpcTimeoutSeconds?: number;
  /** Default timeout in seconds for queue receive operations. Default: 10. */
  defaultQueueReceiveTimeoutSeconds?: number;
  /** Default timeout in seconds for queue poll operations. Default: 30. */
  defaultQueuePollTimeoutSeconds?: number;
}
