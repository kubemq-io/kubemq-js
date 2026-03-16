import type {
  Transport,
  TransportCallOptions,
  StreamHandle,
} from '../../src/internal/transport/transport.js';
import { ConnectionState } from '../../src/internal/transport/connection-state.js';
import { SubscriptionTracker } from '../../src/internal/transport/subscription-tracker.js';
import { ClientClosedError, ErrorCode } from '../../src/errors.js';

interface RecordedCall {
  method: string;
  request?: unknown;
  options?: TransportCallOptions;
  timestamp: number;
}

interface MockStreamHandle<TWrite, TRead> extends StreamHandle<TWrite, TRead> {
  simulateData(data: TRead): void;
  simulateError(err: Error): void;
  simulateEnd(): void;
  readonly written: TWrite[];
  readonly cancelled: boolean;
}

type UnaryHandler = (method: string, request: unknown) => unknown | Promise<unknown>;

export class MockTransport implements Transport {
  private _state: ConnectionState = ConnectionState.IDLE;
  private readonly _calls: RecordedCall[] = [];
  private readonly _unaryHandlers = new Map<string, UnaryHandler>();
  private readonly _stateListeners = new Set<(state: ConnectionState) => void>();
  private _connectBehavior: 'success' | 'fail' | 'hang' = 'success';
  private _connectError?: Error;
  private readonly _subscriptionTracker = new SubscriptionTracker();
  private _stateMachine: unknown = null;

  get state(): ConnectionState {
    return this._state;
  }

  get calls(): readonly RecordedCall[] {
    return this._calls;
  }

  callsTo(method: string): RecordedCall[] {
    return this._calls.filter((c) => c.method === method);
  }

  reset(): void {
    this._calls.length = 0;
    this._unaryHandlers.clear();
    this._state = ConnectionState.IDLE;
    this._connectBehavior = 'success';
    this._connectError = undefined;
  }

  onUnaryCall(method: string, handler: UnaryHandler): void {
    this._unaryHandlers.set(method, handler);
  }

  setConnectBehavior(behavior: 'success' | 'fail' | 'hang', error?: Error): void {
    this._connectBehavior = behavior;
    this._connectError = error;
  }

  simulateDisconnect(): void {
    this.transitionTo(ConnectionState.RECONNECTING);
  }

  simulateReconnect(): void {
    this.transitionTo(ConnectionState.READY);
  }

  async connect(): Promise<void> {
    this.transitionTo(ConnectionState.CONNECTING);

    switch (this._connectBehavior) {
      case 'success':
        this.transitionTo(ConnectionState.READY);
        return;
      case 'fail':
        throw this._connectError ?? new Error('Mock connection failed');
      case 'hang':
        return new Promise(() => {});
    }
  }

  async close(_timeoutMs?: number): Promise<void> {
    this.transitionTo(ConnectionState.CLOSED);
  }

  async unaryCall<TReq, TRes>(
    method: string,
    request: TReq,
    options?: TransportCallOptions,
  ): Promise<TRes> {
    this._calls.push({ method, request, options, timestamp: Date.now() });

    const handler = this._unaryHandlers.get(method);
    if (!handler) {
      throw new Error(`MockTransport: no handler registered for unary method "${method}"`);
    }
    return (await handler(method, request)) as TRes;
  }

  serverStream<_TReq, TRes>(
    method: string,
    request: _TReq,
    options?: TransportCallOptions,
  ): MockStreamHandle<never, TRes> {
    this._calls.push({ method, request, options, timestamp: Date.now() });
    return createMockStreamHandle<never, TRes>();
  }

  duplexStream<TReq, TRes>(
    method: string,
    options?: TransportCallOptions,
  ): MockStreamHandle<TReq, TRes> {
    this._calls.push({ method, options, timestamp: Date.now() });
    return createMockStreamHandle<TReq, TRes>();
  }

  ensureNotClosed(operation: string): void {
    if (this._state === ConnectionState.CLOSED) {
      throw new ClientClosedError({
        code: ErrorCode.ClientClosed,
        message: `Client is closed — cannot perform ${operation}`,
        operation,
        isRetryable: false,
      });
    }
  }

  getSubscriptionTracker(): SubscriptionTracker {
    return this._subscriptionTracker;
  }

  getStateMachine(): unknown {
    if (!this._stateMachine) {
      const self = this;
      this._stateMachine = {
        on(_event: string, handler: (state: ConnectionState) => void) {
          self._stateListeners.add(handler);
        },
        off(_event: string, handler: (state: ConnectionState) => void) {
          self._stateListeners.delete(handler);
        },
      };
    }
    return this._stateMachine;
  }

  getMetadata(): Record<string, string> {
    return {};
  }

  setMetadata(_key: string, _value: string): void {}

  on(event: 'stateChange', handler: (state: ConnectionState) => void): void {
    if (event === 'stateChange') this._stateListeners.add(handler);
  }

  off(event: 'stateChange', handler: (state: ConnectionState) => void): void {
    if (event === 'stateChange') this._stateListeners.delete(handler);
  }

  private transitionTo(newState: ConnectionState): void {
    this._state = newState;
    for (const listener of this._stateListeners) {
      listener(newState);
    }
  }
}

function createMockStreamHandle<TWrite, TRead>(): MockStreamHandle<TWrite, TRead> {
  const dataHandlers: ((msg: TRead) => void)[] = [];
  const errorHandlers: ((err: Error) => void)[] = [];
  const endHandlers: (() => void)[] = [];
  const writtenMessages: TWrite[] = [];
  let isCancelled = false;

  return {
    write(msg: TWrite): boolean {
      writtenMessages.push(msg);
      return true;
    },
    onData(handler: (msg: TRead) => void): void {
      dataHandlers.push(handler);
    },
    onError(handler: (err: Error) => void): void {
      errorHandlers.push(handler);
    },
    onEnd(handler: () => void): void {
      endHandlers.push(handler);
    },
    cancel(): void {
      isCancelled = true;
    },
    end(): void {
      for (const h of endHandlers) h();
    },
    simulateData(data: TRead): void {
      for (const h of dataHandlers) h(data);
    },
    simulateError(err: Error): void {
      for (const h of errorHandlers) h(err);
    },
    simulateEnd(): void {
      for (const h of endHandlers) h();
    },
    get written(): TWrite[] {
      return writtenMessages;
    },
    get cancelled(): boolean {
      return isCancelled;
    },
  };
}
