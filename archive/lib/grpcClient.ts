import { credentials } from '@grpc/grpc-js';
import { readFileSync } from 'fs';
import { kubemqClient } from '../../src/protos/generated';
import { PubSubSettings, QueueSettings, Settings } from '../interfaces';

export class GrpcClient {
  protected client: kubemqClient = this.createClient(); // TODO: Types for this, Check it is actually always available.
  protected metadata: any[] = [];
  constructor(protected settings: PubSubSettings | Settings | QueueSettings) {}

  createClient(): kubemqClient {
    let client: kubemqClient;
    this.metadata = this.settings.registrationKey
      ? ['X-Kubemq-Server-Token', this.settings.registrationKey]
      : [];

    if (this.settings.cert) {
      let contents = readFileSync(this.settings.cert);
      client = new kubemqClient(
        `${this.settings.host}:${this.settings.port}`,
        credentials.createSsl(contents),
        this.settings.options,
      );
    } else {
      client = new kubemqClient(
        `${this.settings.host}:${this.settings.port}`,
        credentials.createInsecure(),
        this.settings.options,
      );
    }

    return client;
  }
}
