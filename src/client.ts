import { Config } from './config';
import { Empty, kubemqClient } from './protos';
import { credentials } from '@grpc/grpc-js';
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
export interface ResponseStream<T> {
  on(event: 'data', fn: (item: T) => void): this;
  on(event: 'end', fn: () => void): this;
  // on(event: 'status', fn: (status: grpc.StatusObject) => void): this;
  on(event: 'error', fn: (err: Error) => void): this;
}

export interface IRequestStream<T> {
  write(item: T): void;
  end(): void;
  cancel(): void;
}

export interface IDuplexStream<T, R>
  extends IRequestStream<T>,
    ResponseStream<R> {}
export class Client {
  protected clientOptions: Config;
  protected grpcClient: kubemqClient;
  constructor(Options: Config) {
    this.clientOptions = { ...defaultOptions, ...Options };
    this.init();
  }
  private init() {
    this.grpcClient = new kubemqClient(
      this.clientOptions.address,
      credentials.createInsecure(),
    );
  }
  public ping(): Promise<ServerInfo> {
    return new Promise<ServerInfo>((resolve, reject) => {
      this.grpcClient.ping(new Empty(), (e, res) => {
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
