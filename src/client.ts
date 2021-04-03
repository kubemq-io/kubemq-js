import { Config } from './config';
import * as kubemq from './protos';
import * as grpc from '@grpc/grpc-js';

export enum StreamState {
  Initialized,
  Ready = 1,
  Error,
  Closed,
}
const defaultOptions: Config = {
  address: 'localhost:50000',
  dialTimeout: 30000,
};
export interface ServerInfo {
  host: string;
  version: string;
  serverStartTime: number;
  serverUpTimeSeconds: number;
}

export interface BaseMessage {
  id?: string;
  channel?: string;
  clientId?: string;
  metadata?: string;
  body?: Uint8Array | string;
  tags?: Map<string, string>;
}

export class Client {
  protected clientOptions: Config;
  protected grpcClient: kubemq.kubemqClient;
  constructor(Options: Config) {
    this.clientOptions = { ...defaultOptions, ...Options };
    this.init();
  }
  private init() {
    this.grpcClient = new kubemq.kubemqClient(
      this.clientOptions.address,
      this.getChannelCredentials(),
    );
  }
  protected metadata(): grpc.Metadata {
    const meta = new grpc.Metadata();
    if (this.clientOptions.authToken != null) {
      meta.add('authorization', this.clientOptions.authToken);
    }
    return meta;
  }
  protected callOptions(): grpc.CallOptions {
    return {
      deadline: new Date(Date.now() + this.clientOptions.dialTimeout),
    };
  }
  private getChannelCredentials(): grpc.ChannelCredentials {
    if (this.clientOptions.credentials != null) {
      return grpc.credentials.createSsl(
        this.clientOptions.credentials.rootCertificate,
        null,
        this.clientOptions.credentials.certChain,
      );
    } else {
      return grpc.credentials.createInsecure();
    }
  }
  public ping(): Promise<ServerInfo> {
    return new Promise<ServerInfo>((resolve, reject) => {
      this.grpcClient.ping(new kubemq.Empty(), (e, res) => {
        if (e) {
          reject(e);
          return;
        }
        const serverInfo = {
          host: res.getHost(),
          version: res.getVersion(),
          serverStartTime: res.getServerstarttime(),
          serverUpTimeSeconds: res.getServeruptimeseconds(),
        };
        resolve(serverInfo);
      });
    });
  }
  public close(): void {
    this.grpcClient.close();
  }
}
