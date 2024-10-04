import * as grpc from '@grpc/grpc-js';
import * as fs from 'fs';
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
  public clientId: string;
  protected authToken?: string;
  protected tls: boolean;
  protected tlsCertFile?: string;
  protected tlsKeyFile?: string;
  protected tlsCaCertFile?: string;
  protected maxReceiveSize: number;
  protected reconnectIntervalSeconds: number;
  protected logLevel: string;
  public grpcClient: kubemq.kubemq.kubemqClient;
  private metadata: grpc.Metadata;

  constructor(config: Config) {
    this.address = config.address || 'localhost:50000';
    this.clientId = config.clientId || '';
    this.authToken = config.authToken;
    this.tls = config.tls || false;
    this.tlsCertFile = config.tlsCertFile;
    this.tlsKeyFile = config.tlsKeyFile;
    this.tlsCaCertFile = config.tlsCaCertFile;
    this.maxReceiveSize = config.maxReceiveSize || 1024 * 1024 * 100; // 100MB
    this.reconnectIntervalSeconds = config.reconnectIntervalSeconds || 1; // 1 second
    this.logLevel = config.logLevel || 'INFO';
    this.metadata = new grpc.Metadata();
    if (this.authToken) {
      this.metadata.add('authorization', this.authToken);
    }

    this.init();
  }

  private init() {
    let channelCredentials: grpc.ChannelCredentials;

    if (this.tls) {
      // Validate that TLS file paths are provided
      if (!this.tlsCertFile || !this.tlsKeyFile) {
        throw new Error(
          'TLS is enabled, but tlsCertFile or tlsKeyFile is missing in the configuration.',
        );
      }

      // Read TLS files
      const certChain = fs.readFileSync(this.tlsCertFile);
      const privateKey = fs.readFileSync(this.tlsKeyFile);
      let rootCerts: Buffer | null = null;

      if (this.tlsCaCertFile) {
        rootCerts = fs.readFileSync(this.tlsCaCertFile);
      }

      // Create SSL credentials
      channelCredentials = grpc.credentials.createSsl(
        rootCerts,
        privateKey,
        certChain,
      );
    } else {
      // Use insecure credentials for non-TLS connections
      channelCredentials = grpc.credentials.createInsecure();
    }

    const channelOptions: grpc.ChannelOptions = {
      'grpc.max_receive_message_length': this.maxReceiveSize,
      // Additional channel options can be added here
    };

    this.grpcClient = new kubemq.kubemq.kubemqClient(
      this.address,
      channelCredentials,
      channelOptions,
    );
  }

  protected callOptions(): grpc.CallOptions {
    return {
      deadline: new Date(Date.now() + 30000),
    };
  }

  public ping(): Promise<ServerInfo> {
    return new Promise((resolve, reject) => {
      this.grpcClient.ping(new kubemq.kubemq.Empty(), (error, response) => {
        if (error) return reject(error);
        resolve({
          host: response.getHost(),
          version: response.getVersion(),
          serverStartTime: response.getServerstarttime(),
          serverUpTimeSeconds: response.getServeruptimeseconds(),
        });
      });
    });
  }

  public close(): void {
    this.grpcClient.close();
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
