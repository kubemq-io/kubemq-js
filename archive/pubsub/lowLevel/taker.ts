import {
  EventReceive,
  kubemqClient,
  Subscribe,
} from '../../../src/protos/generated';
import { ClientReadableStream } from '@grpc/grpc-js';

export class Taker {
  public join?: ClientReadableStream<EventReceive>;

  constructor(public client: kubemqClient) {}

  subscribeToEvents(
    subscribeRequest: Subscribe,
    reqHandler: (...args: any[]) => void,
    errorHandler: (...args: any[]) => void,
  ) {
    this.join = this.client.subscribeToEvents(subscribeRequest);

    this.join.on('error', errorHandler);
    this.join.on('data', reqHandler);

    this.stop = this.stop.bind(this);
  }

  stop() {
    console.log('Stop was called');
    this.join?.cancel();
  }
}
