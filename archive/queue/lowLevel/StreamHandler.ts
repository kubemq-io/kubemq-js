import {
  kubemqClient,
  StreamQueueMessagesRequest,
  StreamQueueMessagesResponse,
} from '../../../src/protos/generated';
import { ClientDuplexStream } from '@grpc/grpc-js';

export class StreamHandler {
  public stream?: ClientDuplexStream<
    StreamQueueMessagesRequest,
    StreamQueueMessagesResponse
  >;

  constructor(public client: kubemqClient) {}

  close() {
    if (this.stream) {
      this.stream.end();
      this.stream = undefined;
      return true;
    } else {
      console.log('Stream is closed');
      return false;
    }
  }

  handleStream(
    req: StreamQueueMessagesRequest,
    cb: (...args: any[]) => any,
    errorCB: (...args: any[]) => any,
  ) {
    this.stream!.on('data', cb);
    this.stream!.on('error', errorCB);
    this.stream!.write(req);
  }

  streamQueueMessage() {
    this.stream = this.client.streamQueueMessage();
  }

  async streamQueueMessageAckRequest(req: StreamQueueMessagesRequest) {
    if (!this.stream) throw new Error('No active stream');

    return this.stream.write(req);
  }

  async streamQueueMessageRejectRequest(req: StreamQueueMessagesRequest) {
    if (!this.stream) throw new Error('No active stream');

    return this.stream.write(req);
  }
}
