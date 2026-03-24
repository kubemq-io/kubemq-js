/** @internal — not part of public API */

import type { ConnectionState } from './connection-state.js';

export interface TransportCallOptions {
  deadline?: Date;
  signal?: AbortSignal;
}

export interface StreamHandle<TWrite, TRead> {
  write(msg: TWrite): boolean;
  onData(handler: (msg: TRead) => void): void;
  onError(handler: (err: Error) => void): void;
  onEnd(handler: () => void): void;
  cancel(): void;
  end(): void;
  /** Pause the readable side of the stream (C3 backpressure). No-op if not supported. */
  pause(): void;
  /** Resume the readable side of the stream (C3 backpressure). No-op if not supported. */
  resume(): void;
  /** Remove all listeners from the underlying stream (H2 rebind cleanup). */
  removeAllListeners(): void;
  /** Register a one-shot handler for when the write buffer drains (writable-side backpressure). */
  onDrain(handler: () => void): void;
}

export interface Transport {
  readonly state: ConnectionState;

  connect(): Promise<void>;
  close(timeoutMs?: number): Promise<void>;

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  unaryCall<TReq, TRes>(
    method: string,
    request: TReq,
    options?: TransportCallOptions,
  ): Promise<TRes>;

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  serverStream<TReq, TRes>(
    method: string,
    request: TReq,
    options?: TransportCallOptions,
  ): StreamHandle<never, TRes>;

  duplexStream<TReq, TRes>(
    method: string,
    options?: TransportCallOptions,
  ): StreamHandle<TReq, TRes>;

  getMetadata(): Record<string, string>;
  setMetadata(key: string, value: string): void;

  on(event: 'stateChange', handler: (state: ConnectionState) => void): void;
  off(event: 'stateChange', handler: (state: ConnectionState) => void): void;
}

/**
 * Transport-level error representation.
 * The Transport layer (Layer 3) converts gRPC ServiceError to this
 * gRPC-decoupled interface. The error-mapper (Layer 2) converts
 * RawTransportError to KubeMQError subclasses without importing @grpc/grpc-js.
 */
export interface RawTransportError extends Error {
  code: number;
  details: string;
  metadata?: Record<string, string>;
}
