import {
  Empty,
  kubemqClient,
  PingResult,
  Request,
  Response,
} from '../../../src/protos';

export class Initiator {
  constructor(public client: kubemqClient) {}

  sendRequest(request: Request): Promise<Response> {
    return new Promise((resolve, reject) => {
      this.client.sendRequest(request, (e: any, res: any) => {
        if (e) reject(e);
        resolve(res);
      });
    });
  }

  ping(): Promise<PingResult> {
    return new Promise((resolve, reject) => {
      this.client.ping(new Empty(), (e: any, res: any) => {
        if (e) reject(e);

        resolve(res);
      });
    });
  }
}
