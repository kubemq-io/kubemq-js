export interface Config {
  /**
   * KubeMQ grpc endpoint address
   * Defaults to localhost:50000
   */
  address?: string;

  /**
   * Connection clientId. Will be set for every rpc call
   */
  clientId?: string;
  /**
   * Duration in milliseconds to wait while connecting before timing out.
   * Defaults to 30 seconds.
   */
  dialTimeout?: number;
  /**
   * Optional client cert credentials for talking to KubeMQ
   */
  credentials?: {
    cert: Buffer;
    key: Buffer;
    caCert?: Buffer;
  };

  /**
   * Connection JWT token.
   */
  authToken?: string;

  /**
   * Duration in milliseconds to wait for RPC (Command and Query) response.
   * Defaults to 60 seconds.
   */
  defaultRpcTimeout?: number;

  reconnectInterval?: number;
}
