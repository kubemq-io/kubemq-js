import {
  kubemqClient,
  ReceiveQueueMessagesRequest,
} from '../../../src/protos/generated';

export class QueueReceiver {
  constructor(public client: kubemqClient) {}

  receiveQueueMessages(req: ReceiveQueueMessagesRequest) {
    return new Promise((resolve, reject) => {
      this.client.receiveQueueMessages(req, (e, res) => {
        if (e) reject(e);

        resolve(res);
      });
    });
  }
}
