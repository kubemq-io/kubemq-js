import {
  AckAllQueueMessagesRequest,
  kubemqClient,
  QueueMessage,
  QueueMessagesBatchRequest,
} from '../../../src/protos/generated';

export class QueueSender {
  constructor(public client: kubemqClient) {}

  sendBulkQueueMessages(messages: QueueMessage[], id: string) {
    const batchRequest = new QueueMessagesBatchRequest();
    batchRequest.setMessagesList(messages);
    batchRequest.setBatchid(id);
    return new Promise((resolve, reject) => {
      this.client.sendQueueMessagesBatch(batchRequest, (e, res) => {
        if (e) reject(e);

        resolve(res);
      });
    });
  }

  ackAllQueueMessages(req: AckAllQueueMessagesRequest) {
    return new Promise((resolve, reject) => {
      this.client.ackAllQueueMessages(req, (e, res) => {
        if (e) reject(e);

        resolve(res);
      });
    });
  }

  sendQueueMessage(message: QueueMessage) {
    return new Promise((resolve, reject) => {
      this.client.sendQueueMessage(message, (e, res) => {
        if (e) reject(e);

        resolve(res);
      });
    });
  }
}
