import { Config } from './config';
import * as kubemq from './protos';
import * as grpc from '@grpc/grpc-js';

/**
 * @internal
 */
const defaultOptions: Config = {
  address: 'localhost:50000',
  dialTimeout: 30000,
  defaultRpcTimeout: 60000,
  reconnectInterval: 1000,
};

/**
 * Server info object returned on Ping
 */
export interface ServerInfo {
  host: string;
  version: string;
  serverStartTime: number;
  serverUpTimeSeconds: number;
}

/**
 * @internal
 */
export interface BaseMessage {
  /** message id, a UUID id will generated when id is empty */
  id?: string;

  /** channel name */
  channel?: string;

  /** optional clientId name specific for this message*/
  clientId?: string;

  /** optional metadata string */
  metadata?: string;

  /** message payload */
  body?: Uint8Array | string;

  /** optional message tags key/value map */
  tags?: Map<string, string>;
}

/**
 * Client - Base class for client connectivity to KubeMQ
 */
export class Client {
  public getMetadata(): grpc.Metadata {
    return this.metadata;
  }

  protected clientOptions: Config;
  protected grpcClient: kubemq.kubemqClient;
  private metadata: grpc.Metadata;
  constructor(Options: Config) {
    this.clientOptions = { ...defaultOptions, ...Options };
    this.init();
  }
  private init() {
    this.grpcClient = new kubemq.kubemqClient(
      this.clientOptions.address,
      this.getChannelCredentials(),
      //  options,
    );
    this.metadata = new grpc.Metadata();
    if (this.clientOptions.authToken != null) {
      this.metadata.add('authorization', this.clientOptions.authToken);
    }
  }

  protected callOptions(): grpc.CallOptions {
    return {
      deadline: new Date(Date.now() + this.clientOptions.dialTimeout),
    };
  }
  /**
   * @internal
   */
  private getChannelCredentials(): grpc.ChannelCredentials {
    if (this.clientOptions.credentials != null) {
      return grpc.credentials.createSsl(
        null,
        this.clientOptions.credentials.key,
        this.clientOptions.credentials.cert,
      );
    } else {
      return grpc.credentials.createInsecure();
    }
  }
  /**
   * Ping - will send a ping message to KubeMQ server.
   * @return Promise<ServerInfo>
   */
  public ping(): Promise<ServerInfo> {
    return new Promise<ServerInfo>((resolve, reject) => {
      this.grpcClient.ping(new kubemq.Empty(), (e, res) => {
        if (e) {
          reject(e);
        } else {
          const serverInfo = {
            host: res.getHost(),
            version: res.getVersion(),
            serverStartTime: res.getServerstarttime(),
            serverUpTimeSeconds: res.getServeruptimeseconds(),
          };
          resolve(serverInfo);
        }
      });
    });
  }
  public close(): void {
    this.grpcClient.close();
  }
}

export interface Listener<T> {
  (event: T): any;
}

export interface Disposable {
  dispose();
}

/** passes through events as they happen. You will not get events from before you start listening */
export class TypedEvent<T> {
  private listeners: Listener<T>[] = [];
  private listenersOncer: Listener<T>[] = [];

  on = (listener: Listener<T>): Disposable => {
    this.listeners.push(listener);
    return {
      dispose: () => this.off(listener),
    };
  };

  once = (listener: Listener<T>): void => {
    this.listenersOncer.push(listener);
  };

  off = (listener: Listener<T>) => {
    const callbackIndex = this.listeners.indexOf(listener);
    if (callbackIndex > -1) this.listeners.splice(callbackIndex, 1);
  };

  emit = (event: T) => {
    /** Update any general listeners */
    this.listeners.forEach((listener) => listener(event));

    /** Clear the `once` queue */
    if (this.listenersOncer.length > 0) {
      const toCall = this.listenersOncer;
      this.listenersOncer = [];
      toCall.forEach((listener) => listener(event));
    }
  };

  pipe = (te: TypedEvent<T>): Disposable => {
    return this.on((e) => te.emit(e));
  };
}
