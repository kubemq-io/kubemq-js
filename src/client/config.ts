export interface Config {
  /**
   * KubeMQ gRPC endpoint address.
   * Defaults to 'localhost:50000'.
   */
  address?: string;

  /**
   * Connection clientId.
   */
  clientId?: string;

  /**
   * Optional JWT authorization token for secure communication.
   */
  authToken?: string;

  /**
   * Indicates if TLS (Transport Layer Security) is enabled.
   */
  tls?: boolean;

  /**
   * Path to the TLS certificate file.
   * Required if `tls` is enabled.
   */
  tlsCertFile?: string;

  /**
   * Path to the TLS key file.
   * Required if `tls` is enabled.
   */
  tlsKeyFile?: string;

  tlsCaCertFile?: string;

  /**
   * Maximum size of the messages to receive (in bytes).
   * Defaults to 100MB.
   */
  maxReceiveSize?: number;

  /**
   * Interval in seconds between reconnect attempts.
   * Defaults to 1 second .
   */
  reconnectIntervalSeconds?: number;

  /**
   * Logging level for the client.
   * Defaults to 'INFO'.
   */
  logLevel?: 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'OFF';
}
