# Running KubeMQ with Kubernetes

This guide covers deploying KubeMQ server alongside Node.js applications
that use the `kubemq-js` SDK.

---

## Deployment Topology

### Standalone Deployment

Run KubeMQ as a separate `Deployment` or `StatefulSet`. Application pods
connect via a Kubernetes `Service`.

**Pros:** independent scaling, simpler upgrades, shared by multiple services.

**Cons:** network hop, requires a Service for discovery.

### Sidecar Deployment

Inject KubeMQ as a sidecar container in the same pod as your application.
The SDK connects to `localhost:50000`.

**Pros:** no network hop, isolated failure domain, co-located lifecycle.

**Cons:** per-pod resource overhead, more complex pod specs.

---

## Standalone Deployment Example

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kubemq
  labels:
    app: kubemq
spec:
  replicas: 1
  selector:
    matchLabels:
      app: kubemq
  template:
    metadata:
      labels:
        app: kubemq
    spec:
      containers:
        - name: kubemq
          image: kubemq/kubemq:latest
          ports:
            - containerPort: 50000
              name: grpc
            - containerPort: 8080
              name: api
            - containerPort: 9090
              name: rest
          env:
            - name: KUBEMQ_TOKEN
              valueFrom:
                secretKeyRef:
                  name: kubemq-license
                  key: token
                  optional: true
          resources:
            requests:
              cpu: 250m
              memory: 256Mi
            limits:
              cpu: '1'
              memory: 512Mi
          readinessProbe:
            httpGet:
              path: /health
              port: api
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /health
              port: api
            initialDelaySeconds: 10
            periodSeconds: 15
---
apiVersion: v1
kind: Service
metadata:
  name: kubemq
spec:
  selector:
    app: kubemq
  ports:
    - name: grpc
      port: 50000
      targetPort: grpc
    - name: api
      port: 8080
      targetPort: api
```

Connect from your SDK:

```typescript
import { KubeMQClient } from 'kubemq-js';

const client = new KubeMQClient({ address: 'kubemq:50000' });
```

---

## Sidecar Deployment Example

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
        - name: app
          image: my-app:latest
          env:
            - name: KUBEMQ_ADDRESS
              value: 'localhost:50000'

        - name: kubemq
          image: kubemq/kubemq:latest
          ports:
            - containerPort: 50000
            - containerPort: 8080
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 256Mi
          readinessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 3
            periodSeconds: 5
```

Connect from your SDK (sidecar):

```typescript
const client = new KubeMQClient({
  address: process.env.KUBEMQ_ADDRESS ?? 'localhost:50000',
});
```

---

## Graceful Shutdown (SIGTERM)

Kubernetes sends `SIGTERM` when scaling down or rolling out new versions.
The SDK supports cooperative cancellation through `AbortSignal` and a
`close()` method that waits for in-flight callbacks to complete.

```typescript
import { KubeMQClient } from 'kubemq-js';

const client = new KubeMQClient({ address: 'kubemq:50000' });

async function shutdown() {
  console.log('Received SIGTERM — draining...');
  await client.close();
  console.log('Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

> **Tip:** Set `terminationGracePeriodSeconds` in your pod spec to a value
> long enough for in-flight messages to drain (default is 30 s).

---

## Health Probes

Expose an HTTP health endpoint in your Node.js application that
reflects the SDK connection state:

```typescript
import http from 'node:http';
import { KubeMQClient, ConnectionState } from 'kubemq-js';

const client = new KubeMQClient({ address: 'kubemq:50000' });

const server = http.createServer((_req, res) => {
  const state = client.connectionState;
  if (state === ConnectionState.Connected) {
    res.writeHead(200).end('ok');
  } else {
    res.writeHead(503).end(state);
  }
});

server.listen(3000);
```

Then configure the probes in your pod spec:

```yaml
readinessProbe:
  httpGet:
    path: /
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 10
livenessProbe:
  httpGet:
    path: /
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 15
```

---

## Resource Limits Recommendations

| Component           | CPU request | CPU limit | Memory request | Memory limit |
| ------------------- | ----------- | --------- | -------------- | ------------ |
| KubeMQ (standalone) | 250m        | 1 core    | 256Mi          | 512Mi        |
| KubeMQ (sidecar)    | 100m        | 500m      | 128Mi          | 256Mi        |
| Node.js app         | 100m        | 500m      | 128Mi          | 512Mi        |

Adjust based on your throughput requirements. Monitor actual usage with
`kubectl top` or Prometheus metrics before tuning.

---

## Additional Tips

- **Service mesh:** If using Istio/Linkerd, the gRPC connection from the
  SDK benefits from automatic mTLS. No SDK configuration changes needed.
- **Network policies:** Allow egress from your app pod to port `50000` on
  the KubeMQ service (or `localhost` for sidecar).
- **Persistent queues:** If you need queue durability across restarts,
  mount a `PersistentVolumeClaim` on the KubeMQ container at `/store`.
- **Horizontal scaling:** KubeMQ supports clustering. See the
  [KubeMQ documentation](https://docs.kubemq.io) for multi-node setup.
