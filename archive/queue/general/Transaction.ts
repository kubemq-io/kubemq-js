import { StreamHandler } from '../lowLevel/StreamHandler';
import {
  StreamQueueMessagesRequest,
  StreamRequestType,
} from '../../../src/protos/generated';
import { Util } from '../../classes';
import { GrpcClient } from '../../lib';
import { QueueSettings } from '../../interfaces';

export class Transaction extends GrpcClient {
  handler: StreamHandler = new StreamHandler(this.client);

  constructor(protected queueSettings: QueueSettings) {
    super(queueSettings);
  }

  public async ack(seq: number) {
    const req = new StreamQueueMessagesRequest();
    req.setClientid(this.settings.client);
    req.setChannel(this.queueSettings.queue);
    req.setRequestid(Util.generateId());
    req.setStreamrequesttypedata(StreamRequestType.ACKMESSAGE);
    req.setVisibilityseconds(0);
    req.setWaittimeseconds(0);
    req.setRefsequence(seq);

    return this.handler.streamQueueMessageAckRequest(req);
  }

  public async reject(seq: number) {
    const req = new StreamQueueMessagesRequest();
    req.setClientid(this.settings.client);
    req.setChannel(this.queueSettings.queue);
    req.setRequestid(Util.generateId());
    req.setStreamrequesttypedata(StreamRequestType.REJECTMESSAGE);
    req.setVisibilityseconds(0);
    req.setWaittimeseconds(0);
    req.setRefsequence(seq);

    return this.handler.streamQueueMessageRejectRequest(req);
  }

  async receive(
    cb: (...args: any[]) => any,
    errorCB: (...args: any[]) => any,
    visibility: number = 1,
  ) {
    if (this.openStream())
      return Promise.reject('Stream already open, please call ack');

    const req = new StreamQueueMessagesRequest();
    req.setClientid(this.settings.client);
    req.setChannel(this.queueSettings.queue);
    req.setRequestid(Util.generateId());
    req.setStreamrequesttypedata(StreamRequestType.RECEIVEMESSAGE);
    req.setVisibilityseconds(visibility);
    req.setWaittimeseconds(this.queueSettings.waitTime);
    req.setRefsequence(0);

    return this.handler.handleStream(req, cb, errorCB);
  }

  private openStream() {
    if (!this.handler.stream) {
      this.handler.streamQueueMessage();
      return false;
    } else {
      return true;
    }
  }

  // private closeStream() { // TODO: Look into async-locks
  // 	this.handler.close()
  // }
  //
  // private checkCallIsInTransaction() {
  // 	return !!this.handler.stream;
  // }
}
