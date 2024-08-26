import * as grpc from '@grpc/grpc-js';
import * as kubemq from '../protos';
import { Config } from './config';

/**
 * Represents the server information returned on a Ping request.
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
 * KubeMQClient - Client for communicating with a KubeMQ server using gRPC.
 * Supports plain and TLS (Transport Layer Security) connections.
 */
export class KubeMQClient {

  protected address: string;
  protected clientId: string;
  protected authToken?: string;
  protected tls: boolean;
  protected tlsCertFile?: Buffer;
  protected tlsKeyFile?: Buffer;
  protected maxReceiveSize: number;
  protected reconnectIntervalSeconds: number;
  protected keepAlive?: boolean;
  protected pingIntervalInSeconds: number;
  protected pingTimeoutInSeconds: number;
  protected logLevel: string;
  public grpcClient: kubemq.kubemqClient;
  protected channel: grpc.Channel;
  private metadata: grpc.Metadata;

  constructor(config: Config) {
    this.address = config.address || 'localhost:50000';
    this.clientId = config.clientId || '';
    this.authToken = config.authToken;
    this.tls = !!config.credentials;
    this.tlsCertFile = config.credentials?.cert;
    this.tlsKeyFile = config.credentials?.key;
    this.maxReceiveSize = config.maxReceiveSize || 1024 * 1024 * 100; // 100MB
    this.reconnectIntervalSeconds = config.reconnectInterval || 1000; // 1 second
    this.keepAlive = config.keepAlive;
    this.pingIntervalInSeconds = config.pingIntervalInSeconds || 60;
    this.pingTimeoutInSeconds = config.pingTimeoutInSeconds || 30;
    this.logLevel = config.logLevel || 'INFO';

    this.metadata = new grpc.Metadata();
    if (this.authToken) {
      this.metadata.add('authorization', this.authToken);
    }

    this.init();
  }

  private init() {
    const channelCredentials = this.tls
      ? grpc.credentials.createSsl(
          this.tlsCertFile!,
          this.tlsKeyFile!
        )
      : grpc.credentials.createInsecure();

    const channelOptions: grpc.ChannelOptions = {
      'grpc.max_receive_message_length': this.maxReceiveSize,
      'grpc.keepalive_time_ms': this.pingIntervalInSeconds * 1000,
      'grpc.keepalive_timeout_ms': this.pingTimeoutInSeconds * 1000,
      'grpc.keepalive_permit_without_calls': this.keepAlive ? 1 : 0
    };

    this.channel = new grpc.Channel(this.address, channelCredentials, channelOptions);
    this.grpcClient = new kubemq.kubemqClient(this.address,channelCredentials,channelOptions);
    this.metadata = new grpc.Metadata();
    if (this.authToken != null) {
      this.metadata.add('authorization', this.authToken);
    }

  }

  protected callOptions(): grpc.CallOptions {
    return {
      deadline: new Date(Date.now() + 30000),
    };
  }

  public async ping(): Promise<ServerInfo> {
    return new Promise<ServerInfo>((resolve, reject) => {
      this.grpcClient.ping(new kubemq.Empty(), (error, response) => {
        if (error) {
          reject(error);
        } else {
          resolve({
            host: response.getHost(),
            version: response.getVersion(),
            serverStartTime: response.getServerstarttime(),
            serverUpTimeSeconds: response.getServeruptimeseconds(),
          });
        }
      });
    });
  }

  public close(): void {
    this.channel.close();
  }

  public getMetadata(): grpc.Metadata {
    return this.metadata;
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