import { Event, kubemqClient, Result } from '../../../src/protos/generated';

export class Giver {
  constructor(public client: kubemqClient) {}

  sendEvent(event: Event): Promise<Result> {
    return new Promise((resolve, reject) => {
      this.client.sendEvent(event, (e: any, res: any) => {
        if (e) reject(e);

        resolve(res);
      });
    });
  }
}
