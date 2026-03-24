# How To: Connect with TLS and mTLS

Configure encrypted connections to KubeMQ using TLS (server verification) or mTLS (mutual certificate authentication).

## TLS — Server Certificate Verification

```typescript
import { KubeMQClient } from 'kubemq-js';

const client = await KubeMQClient.create({
  address: 'kubemq-server:50000',
  clientId: 'my-service',
  tls: {
    enabled: true,
    caCert: '/path/to/ca-cert.pem',
  },
});

console.log('Connected with TLS. State:', client.state);
await client.close();
```

## mTLS — Mutual Certificate Authentication

```typescript
import { KubeMQClient } from 'kubemq-js';

const client = await KubeMQClient.create({
  address: 'kubemq-server:50000',
  clientId: 'my-service',
  tls: {
    enabled: true,
    caCert: '/path/to/ca-cert.pem',
    clientCert: '/path/to/client-cert.pem',
    clientKey: '/path/to/client-key.pem',
  },
});

const info = await client.ping();
console.log(`Connected with mTLS — server: ${info.version}`);
await client.close();
```

## Using PEM Strings from Environment Variables

Load certificates from Vault, K8s secrets, or environment variables:

```typescript
import { KubeMQClient } from 'kubemq-js';

const client = await KubeMQClient.create({
  address: 'kubemq-server:50000',
  clientId: 'my-service',
  tls: {
    enabled: true,
    caCert: Buffer.from(process.env.CA_CERT!, 'utf-8'),
    clientCert: Buffer.from(process.env.CLIENT_CERT!, 'utf-8'),
    clientKey: Buffer.from(process.env.CLIENT_KEY!, 'utf-8'),
  },
});

console.log('Connected with PEM from env vars');
await client.close();
```

## Development: Skip Certificate Verification

```typescript
import { KubeMQClient } from 'kubemq-js';

const client = await KubeMQClient.create({
  address: 'dev-server:50000',
  tls: {
    enabled: true,
    insecureSkipVerify: true, // NEVER use in production
  },
});
```

## TLS with Server Name Override

When the server certificate CN doesn't match the address:

```typescript
import { KubeMQClient } from 'kubemq-js';

const client = await KubeMQClient.create({
  address: '10.0.1.50:50000',
  tls: {
    enabled: true,
    caCert: '/path/to/ca-cert.pem',
    serverNameOverride: 'kubemq.internal.example.com',
  },
});
```

## TLS with Auth Token

Combine TLS encryption with token-based authentication:

```typescript
import { KubeMQClient } from 'kubemq-js';

const client = await KubeMQClient.create({
  address: 'kubemq-server:50000',
  credentials: 'your-jwt-token-here',
  tls: {
    enabled: true,
    caCert: '/path/to/ca-cert.pem',
  },
});
```

## Handling TLS Errors

```typescript
import { KubeMQClient, ConnectionError } from 'kubemq-js';

try {
  const client = await KubeMQClient.create({
    address: 'kubemq-server:50000',
    tls: {
      enabled: true,
      caCert: '/path/to/ca-cert.pem',
    },
  });
} catch (err) {
  if (err instanceof ConnectionError) {
    console.error('TLS connection failed:', err.message);
    console.error('Suggestion:', err.suggestion);
  }
}
```

## Troubleshooting

| Symptom                                   | Cause                                | Fix                                           |
| ----------------------------------------- | ------------------------------------ | --------------------------------------------- |
| `UNAVAILABLE: Connection refused`         | Server not running or wrong port     | Verify server address and port                |
| `UNAVAILABLE: failed to connect` with TLS | CA cert doesn't match server cert    | Use the CA that signed the server certificate |
| `ERR_TLS_CERT_ALTNAME_INVALID`            | Hostname mismatch                    | Use `serverNameOverride` or fix the cert      |
| Connection hangs                          | TLS disabled for TLS-required server | Set `tls: { enabled: true }`                  |
| `ENOENT: no such file`                    | Wrong certificate file path          | Verify paths exist and are readable           |
