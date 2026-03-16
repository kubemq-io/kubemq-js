/**
 * GrpcTransport — single gRPC channel per client instance.
 *
 * Implements the Transport interface (Layer 3) and owns:
 * - One @grpc/grpc-js Client (connection reuse, REQ-CONN-6)
 * - Connection state machine (REQ-CONN-2)
 * - Reconnection manager (REQ-CONN-1)
 * - Message buffer (REQ-CONN-1)
 * - In-flight tracker (REQ-CONN-4)
 * - Subscription tracker (REQ-CONN-1)
 *
 * @internal
 */

import * as grpc from '@grpc/grpc-js';
import { kubemq } from '../../protos/kubemq.js';
import type { Logger } from '../../logger.js';
import type {
  ClientOptions,
  KeepaliveOptions,
  ReconnectionPolicy,
  TlsOptions,
} from '../../options.js';
import { DEFAULT_KEEPALIVE, DEFAULT_RECONNECTION_POLICY } from '../../options.js';
import { ConnectionState } from './connection-state.js';
import { ConnectionStateMachine } from './connection-state-machine.js';
import { ReconnectionManager } from './reconnection-manager.js';
import { MessageBuffer } from './message-buffer.js';
import type { BufferedMessage } from './message-buffer.js';
import { InFlightTracker } from './in-flight-tracker.js';
import { SubscriptionTracker } from './subscription-tracker.js';
import { ClientClosedError, ErrorCode } from '../../errors.js';
import { noopLogger } from '../../logger.js';
import type {
  Transport,
  TransportCallOptions,
  StreamHandle,
  RawTransportError,
} from './transport.js';
import type { ConnectionEventMap } from './typed-emitter.js';
import { resolveCredentialProvider } from '../../auth/credential-provider.js';
import type { CredentialProvider } from '../../auth/credential-provider.js';
import { TokenCache } from '../../auth/token-cache.js';
import {
  normalizeTlsOptions,
  validateCertificates,
  isLocalhostAddress,
  resolveSslParts,
  buildFreshSslParts,
} from '../../auth/tls-utils.js';
import type { TlsCredentialSource, SslCredentialParts } from '../../auth/tls-utils.js';
import {
  emitSecurityWarnings,
  fetchTokenForMetadata,
  AUTH_METADATA_KEY,
} from '../middleware/auth.js';

export interface GrpcChannelOptions {
  'grpc.max_receive_message_length': number;
  'grpc.max_send_message_length': number;
  'grpc.keepalive_time_ms': number;
  'grpc.keepalive_timeout_ms': number;
  'grpc.keepalive_permit_without_calls': number;
  'grpc.dns_min_time_between_resolutions_ms': number;
  'grpc.initial_reconnect_backoff_ms': number;
  'grpc.max_reconnect_backoff_ms': number;
  'grpc.min_reconnect_backoff_ms': number;
  'grpc.ssl_target_name_override'?: string;
}

export function buildChannelOptions(opts: ClientOptions): GrpcChannelOptions {
  const keepalive: KeepaliveOptions = opts.keepalive ?? DEFAULT_KEEPALIVE;
  const reconnect: ReconnectionPolicy = opts.reconnect ?? DEFAULT_RECONNECTION_POLICY;
  const tlsOpts: TlsOptions | undefined = typeof opts.tls === 'object' ? opts.tls : undefined;

  const channelOptions: GrpcChannelOptions = {
    'grpc.max_receive_message_length': opts.maxReceiveMessageSize ?? 104_857_600,
    'grpc.max_send_message_length': opts.maxSendMessageSize ?? 104_857_600,
    'grpc.keepalive_time_ms': keepalive.timeMs,
    'grpc.keepalive_timeout_ms': keepalive.timeoutMs,
    'grpc.keepalive_permit_without_calls': keepalive.permitWithoutCalls ? 1 : 0,
    'grpc.dns_min_time_between_resolutions_ms': 1_000,
    'grpc.initial_reconnect_backoff_ms': reconnect.initialDelayMs,
    'grpc.max_reconnect_backoff_ms': reconnect.maxDelayMs,
    'grpc.min_reconnect_backoff_ms': reconnect.initialDelayMs,
  };

  if (tlsOpts?.serverNameOverride) {
    channelOptions['grpc.ssl_target_name_override'] = tlsOpts.serverNameOverride;
  }

  return channelOptions;
}

export class GrpcTransport implements Transport {
  private readonly logger: Logger;
  private readonly stateMachine: ConnectionStateMachine;
  private readonly reconnectionManager: ReconnectionManager;
  private readonly messageBuffer: MessageBuffer;
  private readonly inFlightTracker: InFlightTracker;
  private readonly subscriptionTracker: SubscriptionTracker;
  private readonly channelOptions: GrpcChannelOptions;
  private readonly address: string;
  private _closing = false;
  private readonly metadata = new Map<string, string>();

  private grpcClient: InstanceType<typeof kubemq.kubemqClient> | null = null;

  private readonly credentialProvider: CredentialProvider | undefined;
  private readonly tokenCache: TokenCache | undefined;
  private readonly resolvedTls: TlsOptions & { enabled: boolean };
  private readonly tlsCredentialSource: TlsCredentialSource | undefined;

  constructor(options: ClientOptions) {
    this.address = options.address;
    this.logger = options.logger ?? noopLogger;
    this.channelOptions = buildChannelOptions(options);
    this.stateMachine = new ConnectionStateMachine(this.logger);
    this.reconnectionManager = new ReconnectionManager(
      options.reconnect ?? DEFAULT_RECONNECTION_POLICY,
      this.stateMachine,
      this.logger,
    );
    this.messageBuffer = new MessageBuffer(
      options.reconnectBufferSize ?? 8_388_608,
      options.reconnectBufferMode ?? 'error',
      this.logger,
    );
    this.inFlightTracker = new InFlightTracker();
    this.subscriptionTracker = new SubscriptionTracker();

    this.credentialProvider = resolveCredentialProvider(options.credentials);
    if (this.credentialProvider) {
      this.tokenCache = new TokenCache(this.credentialProvider, this.logger);
    }

    this.resolvedTls = normalizeTlsOptions(options.tls, options.address);
    if (this.resolvedTls.enabled) {
      this.tlsCredentialSource = {
        options: this.resolvedTls,
        logger: this.logger,
      };
    }
  }

  get state(): ConnectionState {
    return this.stateMachine.state;
  }

  getStateMachine(): ConnectionStateMachine {
    return this.stateMachine;
  }

  getInFlightTracker(): InFlightTracker {
    return this.inFlightTracker;
  }

  getMessageBuffer(): MessageBuffer {
    return this.messageBuffer;
  }

  getReconnectionManager(): ReconnectionManager {
    return this.reconnectionManager;
  }

  getSubscriptionTracker(): SubscriptionTracker {
    return this.subscriptionTracker;
  }

  getChannelOptions(): GrpcChannelOptions {
    return this.channelOptions;
  }

  /**
   * Validate TLS certificates and emit security warnings.
   * Must be called before connect() to enforce fail-fast semantics.
   */
  async validateAuth(): Promise<void> {
    if (this.resolvedTls.enabled) {
      await validateCertificates(this.resolvedTls, this.logger);
    }

    emitSecurityWarnings(
      {
        insecureSkipVerify: this.resolvedTls.insecureSkipVerify,
        tlsEnabled: this.resolvedTls.enabled,
        address: this.address,
      },
      isLocalhostAddress(this.address),
      this.logger,
    );
  }

  /**
   * Resolve SSL credential parts for the current TLS configuration.
   * Used during initial connect and reconnection (cert rotation).
   */
  async resolveSslCredentials(): Promise<SslCredentialParts | undefined> {
    if (!this.tlsCredentialSource) return undefined;
    return resolveSslParts(this.resolvedTls, this.logger);
  }

  /**
   * Rebuild SSL credentials from source (re-reads files for cert rotation).
   */
  async reloadSslCredentials(): Promise<SslCredentialParts | undefined> {
    if (!this.tlsCredentialSource) return undefined;
    return buildFreshSslParts(this.tlsCredentialSource);
  }

  getTokenCache(): TokenCache | undefined {
    return this.tokenCache;
  }

  getCredentialProvider(): CredentialProvider | undefined {
    return this.credentialProvider;
  }

  getResolvedTls(): TlsOptions & { enabled: boolean } {
    return this.resolvedTls;
  }

  async connect(): Promise<void> {
    await this.validateAuth();
    this.stateMachine.transitionTo(ConnectionState.CONNECTING);

    const sslParts = await this.resolveSslCredentials();

    let channelCreds: grpc.ChannelCredentials;
    if (this.resolvedTls.enabled && sslParts) {
      channelCreds = grpc.credentials.createSsl(
        sslParts.rootCerts,
        sslParts.clientKey,
        sslParts.clientCert,
      );
    } else {
      channelCreds = grpc.credentials.createInsecure();
    }

    let finalCreds: grpc.ChannelCredentials = channelCreds;
    if (this.tokenCache && this.resolvedTls.enabled) {
      const tokenCache = this.tokenCache;
      const logger = this.logger;
      const callCreds = grpc.credentials.createFromMetadataGenerator((_params, callback) => {
        fetchTokenForMetadata(tokenCache, logger)
          .then((token) => {
            const md = new grpc.Metadata();
            if (token) {
              md.set(AUTH_METADATA_KEY, token);
            }
            callback(null, md);
          })
          .catch((err: unknown) => {
            callback(err instanceof Error ? err : new Error(String(err)));
          });
      });
      finalCreds = grpc.credentials.combineChannelCredentials(channelCreds, callCreds);
    } else if (this.tokenCache && !this.resolvedTls.enabled) {
      this.logger.warn('Auth credentials provided without TLS — token will be sent in plaintext', {
        address: this.address,
      });
      await this.tokenCache.getToken();
    }

    this.grpcClient = new kubemq.kubemqClient(this.address, finalCreds, this.channelOptions);

    this.stateMachine.transitionTo(ConnectionState.READY);
    this.watchChannelState();
  }

  async close(timeoutMs?: number): Promise<void> {
    const timeout = timeoutMs ?? 5000;

    if (this.stateMachine.state === ConnectionState.CLOSED) {
      return;
    }

    this._closing = true;

    if (this.stateMachine.state === ConnectionState.RECONNECTING) {
      this.reconnectionManager.cancel();
      const discarded = this.messageBuffer.discard();
      this.stateMachine.transitionTo(ConnectionState.CLOSED, { discardedCount: discarded });
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/require-await
      await this.messageBuffer.flush(async (msg: BufferedMessage) => {
        msg.resolve(undefined);
      });
    } catch (err: unknown) {
      this.logger.warn('Buffer flush failed during shutdown', {
        error: err instanceof Error ? err.message : String(err),
      });
      this.messageBuffer.discard();
    }

    await Promise.race([this.inFlightTracker.waitForAll(), this.createTimeout(timeout)]).catch(
      () => {
        // Timeout reached — proceed with shutdown
      },
    );

    this.subscriptionTracker.clear();
    this.tokenCache?.dispose();

    if (this.grpcClient) {
      this.grpcClient.close();
      this.grpcClient = null;
    }

    this.stateMachine.transitionTo(ConnectionState.CLOSED);
  }

  ensureNotClosed(operation: string): void {
    if (this._closing || this.stateMachine.state === ConnectionState.CLOSED) {
      throw new ClientClosedError({
        code: ErrorCode.ClientClosed,
        message: 'Client is closed — cannot perform operations',
        operation,
        isRetryable: false,
        suggestion: 'Create a new KubeMQClient instance',
      });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  unaryCall<TReq, TRes>(
    method: string,
    request: TReq,
    options?: TransportCallOptions,
  ): Promise<TRes> {
    this.ensureNotClosed('unaryCall');
    if (!this.grpcClient) throw new Error('Not connected');

    const grpcMethod = (this.grpcClient as Record<string, unknown>)[method] as
      | ((...args: unknown[]) => grpc.ClientUnaryCall)
      | undefined;
    if (!grpcMethod) throw new Error(`Unknown method: ${method}`);

    return new Promise<TRes>((resolve, reject) => {
      const metadata = this.buildGrpcMetadata();
      const callOptions: grpc.CallOptions = {};
      if (options?.deadline) callOptions.deadline = options.deadline;

      const call = grpcMethod.call(
        this.grpcClient,
        request,
        metadata,
        callOptions,
        (err: grpc.ServiceError | null, response: TRes) => {
          if (err) {
            reject(this.toRawTransportError(err));
          } else {
            resolve(response);
          }
        },
      );

      if (options?.signal) {
        const onAbort = () => {
          call.cancel();
        };
        options.signal.addEventListener('abort', onAbort, { once: true });
      }
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  serverStream<TReq, TRes>(
    method: string,
    request: TReq,
    options?: TransportCallOptions,
  ): StreamHandle<never, TRes> {
    this.ensureNotClosed('serverStream');
    if (!this.grpcClient) throw new Error('Not connected');

    const grpcMethod = (this.grpcClient as Record<string, unknown>)[method] as
      | ((...args: unknown[]) => grpc.ClientReadableStream<TRes>)
      | undefined;
    if (!grpcMethod) throw new Error(`Unknown method: ${method}`);

    const metadata = this.buildGrpcMetadata();
    const callOptions: grpc.CallOptions = {};
    if (options?.deadline) callOptions.deadline = options.deadline;

    const stream: grpc.ClientReadableStream<TRes> = grpcMethod.call(
      this.grpcClient,
      request,
      metadata,
      callOptions,
    );

    if (options?.signal) {
      const onAbort = () => {
        stream.cancel();
      };
      options.signal.addEventListener('abort', onAbort, { once: true });
    }

    return this.wrapReadableStream<TRes>(stream);
  }

  duplexStream<TReq, TRes>(
    method: string,
    options?: TransportCallOptions,
  ): StreamHandle<TReq, TRes> {
    this.ensureNotClosed('duplexStream');
    if (!this.grpcClient) throw new Error('Not connected');

    const grpcMethod = (this.grpcClient as Record<string, unknown>)[method] as
      | ((...args: unknown[]) => grpc.ClientDuplexStream<TReq, TRes>)
      | undefined;
    if (!grpcMethod) throw new Error(`Unknown method: ${method}`);

    const metadata = this.buildGrpcMetadata();
    const callOptions: grpc.CallOptions = {};
    if (options?.deadline) callOptions.deadline = options.deadline;

    const stream: grpc.ClientDuplexStream<TReq, TRes> = grpcMethod.call(
      this.grpcClient,
      metadata,
      callOptions,
    );

    if (options?.signal) {
      const onAbort = () => {
        stream.cancel();
      };
      options.signal.addEventListener('abort', onAbort, { once: true });
    }

    return this.wrapDuplexStream<TReq, TRes>(stream);
  }

  getMetadata(): Record<string, string> {
    return Object.fromEntries(this.metadata);
  }

  setMetadata(key: string, value: string): void {
    this.metadata.set(key, value);
  }

  on<K extends keyof ConnectionEventMap>(event: K, handler: ConnectionEventMap[K]): void {
    this.stateMachine.on(event, handler);
  }

  off<K extends keyof ConnectionEventMap>(event: K, handler: ConnectionEventMap[K]): void {
    this.stateMachine.off(event, handler);
  }

  private watchChannelState(): void {
    if (!this.grpcClient || this._closing) return;

    try {
      /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
      const channel = (this.grpcClient as any).getChannel();
      const currentState = channel.getConnectivityState(false);

      if (currentState === 3 /* TRANSIENT_FAILURE */) {
        this.handleTransientFailure();
        return;
      }

      const deadline = Date.now() + 30_000;
      channel.watchConnectivityState(currentState, deadline, (err?: Error) => {
        if (err || this._closing) return;
        this.watchChannelState();
      });
      /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
    } catch {
      // Channel may not be available yet or already closed
    }
  }

  private handleTransientFailure(): void {
    if (this._closing || this.stateMachine.state === ConnectionState.CLOSED) return;

    this.logger.warn('gRPC channel entered TRANSIENT_FAILURE — initiating reconnection');
    this.stateMachine.transitionTo(ConnectionState.RECONNECTING);

    this.reconnectionManager
      .reconnect(async () => {
        if (this.grpcClient) {
          try {
            this.grpcClient.close();
          } catch {
            /* ignore close errors during reconnect */
          }
          this.grpcClient = null;
        }
        const sslParts = await this.resolveSslCredentials();
        let channelCreds: grpc.ChannelCredentials;
        if (this.resolvedTls.enabled && sslParts) {
          channelCreds = grpc.credentials.createSsl(
            sslParts.rootCerts,
            sslParts.clientKey,
            sslParts.clientCert,
          );
        } else {
          channelCreds = grpc.credentials.createInsecure();
        }
        let finalCreds = channelCreds;
        if (this.tokenCache && this.resolvedTls.enabled) {
          const tokenCache = this.tokenCache;
          const logger = this.logger;
          const callCreds = grpc.credentials.createFromMetadataGenerator((_params, callback) => {
            fetchTokenForMetadata(tokenCache, logger)
              .then((token) => {
                const md = new grpc.Metadata();
                if (token) md.set(AUTH_METADATA_KEY, token);
                callback(null, md);
              })
              .catch((err: unknown) => {
                callback(err instanceof Error ? err : new Error(String(err)));
              });
          });
          finalCreds = grpc.credentials.combineChannelCredentials(channelCreds, callCreds);
        }
        this.grpcClient = new kubemq.kubemqClient(this.address, finalCreds, this.channelOptions);
        this.watchChannelState();
      })
      .then(() => {
        if (this.subscriptionTracker.count > 0) {
          this.logger.info('Re-establishing subscriptions after reconnection', {
            count: this.subscriptionTracker.count,
          });
          this.subscriptionTracker.resubscribeAll();
        }
      })
      .catch((err: unknown) => {
        this.logger.error('Reconnection loop failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      });
  }

  private buildGrpcMetadata(): grpc.Metadata {
    const metadata = new grpc.Metadata();
    for (const [key, value] of this.metadata) {
      metadata.set(key, value);
    }
    if (this.tokenCache && !this.resolvedTls.enabled) {
      const token = this.tokenCache.lastKnownToken;
      if (token) {
        metadata.set(AUTH_METADATA_KEY, token);
      }
    }
    return metadata;
  }

  private toRawTransportError(err: grpc.ServiceError): RawTransportError {
    const rawErr = new Error(err.details || err.message) as Error & {
      code: number;
      details: string;
      metadata?: Record<string, string>;
    };
    rawErr.code = err.code;
    rawErr.details = err.details || err.message;
    const meta: Record<string, string> = {};
    for (const [key, values] of Object.entries(err.metadata.getMap())) {
      meta[key] = String(values);
    }
    rawErr.metadata = meta;
    return rawErr as RawTransportError;
  }

  private wrapReadableStream<TRes>(
    stream: grpc.ClientReadableStream<TRes>,
  ): StreamHandle<never, TRes> {
    return {
      write(): boolean {
        return false;
      },
      onData(handler: (msg: TRes) => void): void {
        stream.on('data', handler);
      },
      onError(handler: (err: Error) => void): void {
        stream.on('error', handler);
      },
      onEnd(handler: () => void): void {
        stream.on('end', handler);
      },
      cancel(): void {
        stream.cancel();
      },
      end(): void {
        stream.cancel();
      },
    };
  }

  private wrapDuplexStream<TReq, TRes>(
    stream: grpc.ClientDuplexStream<TReq, TRes>,
  ): StreamHandle<TReq, TRes> {
    return {
      write(msg: TReq): boolean {
        return stream.write(msg);
      },
      onData(handler: (msg: TRes) => void): void {
        stream.on('data', handler);
      },
      onError(handler: (err: Error) => void): void {
        stream.on('error', handler);
      },
      onEnd(handler: () => void): void {
        stream.on('end', handler);
      },
      cancel(): void {
        stream.cancel();
      },
      end(): void {
        stream.end();
      },
    };
  }

  private createTimeout(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      if (typeof timer === 'object' && 'unref' in timer) {
        timer.unref();
      }
    });
  }
}
