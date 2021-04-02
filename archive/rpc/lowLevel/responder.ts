import {
  Empty,
  kubemqClient,
  Request,
  Response,
  Subscribe,
} from '../../../src/protos';
import { ClientReadableStream } from '@grpc/grpc-js';

export class Responder {
  public join?: ClientReadableStream<Request>;

  constructor(public client: kubemqClient) {}

  subscribeToRequests(
    subscribeRequest: Subscribe,
    reqHandler: (...args: any[]) => void,
    errorHandler: (...args: any[]) => void,
  ) {
    this.join = this.client.subscribeToRequests(subscribeRequest);

    this.join.on('error', errorHandler);
    this.join.on('data', reqHandler);

    this.stop = this.stop.bind(this);
  }

  stop() {
    console.log('Stop was called');
    this.join?.cancel();
  }

  sendResponse(request: Response): Promise<Empty> {
    return new Promise((resolve, reject) => {
      this.client.sendResponse(request, (e: any, res: any) => {
        if (e) reject(e);

        resolve(res);
      });
    });
  }

  ping() {
    return new Promise((resolve, reject) => {
      this.client.ping(new Empty(), (e: any, res: any) => {
        if (e) reject(e);

        resolve(res);
      });
    });
  }
}
