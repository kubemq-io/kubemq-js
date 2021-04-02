import { credentials } from '@grpc/grpc-js';
import { Settings } from './Settings';
import { kubemqClient } from '../../src/protos';
import * as pb from '../../src/protos';
import { PingResult } from './wrrappers';
import { Empty } from '../../src/protos';
import {
  EventResult,
  Event,
  EventsSubscriber,
  EventsSubscriptionRequest,
  EventReceive,
} from './Events';

export class KubemqClient {
  protected grpcClient: kubemqClient = this.createClient();
  constructor(protected settings: Settings) {}
  createClient(): kubemqClient {
    let client: kubemqClient;
    client = new kubemqClient(
      this.settings.address,
      credentials.createInsecure(),
    );
    const deadline = new Date();
    deadline.setSeconds(deadline.getSeconds() + 1);
    client.waitForReady(deadline, (err: Error | undefined) => {
      if (err) {
        console.error('not-ready', err);
      } else {
        console.log('is ready');
      }
    });
    return client;
  }
  close() {
    this.grpcClient.close();
  }
  ping() {
    return new Promise<PingResult>((resolve, reject) => {
      this.grpcClient.ping(new Empty(), (e, res) => {
        if (e) reject(e);
        resolve(new PingResult(res));
      });
    });
  }
  async sendEvent(event: Event) {
    if (event.clientId === '') {
      event.clientId = this.settings.clientId;
    }
    return new Promise<EventResult>((resolve, reject) => {
      this.grpcClient.sendEvent(event.toPB(), (e) => {
        if (e) reject(e);
        resolve(new EventResult(event.id));
      });
    });
  }
  subscribeToEvents(
    subRequest: EventsSubscriptionRequest,
    reqHandler: (eventReceive: EventReceive) => void,
    errorHandler: (e: any) => void,
    stateHandler?: (state: string) => void,
  ): EventsSubscriber {
    const eventsSubscriber = new EventsSubscriber();
    eventsSubscriber.stream = this.grpcClient.subscribeToEvents(
      subRequest.toPB(this.settings.clientId),
    );
    eventsSubscriber.setState('ready');
    if (stateHandler) {
      stateHandler('ready');
    }
    eventsSubscriber.stream.on('error', function (e) {
      errorHandler(e);
      eventsSubscriber.setState('error');
      if (stateHandler) {
        stateHandler('error');
      }
    });
    eventsSubscriber.stream.on('data', function (data: pb.EventReceive) {
      reqHandler(new EventReceive(data));
    });
    eventsSubscriber.stream.on('end', function () {
      eventsSubscriber.setState('end');
      if (stateHandler) {
        stateHandler('end');
      }
    });
    return eventsSubscriber;
  }
}
