import { Initiator, Responder } from './lowLevel';
import { GrpcClient } from '../lib';
import {
  Empty,
  Request,
  Response,
  Subscribe,
} from '../../src/protos/generated';
import { Settings } from '../interfaces';

export class RPC extends GrpcClient {
  protected initiator: Initiator = new Initiator(this.client);
  protected responder?: Responder;
  constructor(protected rpcSettings: Settings) {
    super(rpcSettings);
  }

  close(): void {
    this.client.close();
    this.responder?.stop();
  }

  protected send(request: Request): Promise<Response> {
    request.setChannel(this.rpcSettings.channel);
    request.setClientid(this.rpcSettings.client);

    request.setRequesttypedata(this.rpcSettings.type);

    if (!request.getTimeout())
      request.setTimeout(this.rpcSettings.defaultTimeout || 3000);

    return this.initiator.sendRequest(request);
  }

  protected subscribe(
    reqHandler: (...args: any[]) => void,
    errorHandler: (...args: any[]) => void,
  ) {
    this.responder = new Responder(this.client);
    let subRequest = new Subscribe();

    // @ts-ignore TODO: 1|2|3|4 < number?
    subRequest.setSubscribetypedata(this.rpcSettings.type + 2);
    subRequest.setClientid(this.rpcSettings.client);
    subRequest.setChannel(this.rpcSettings.channel);
    subRequest.setGroup(this.rpcSettings.group || '');

    this.responder.subscribeToRequests(subRequest, reqHandler, errorHandler);
  }

  protected unsubscribe() {
    if (this.responder) this.responder.stop();
  }

  protected async sendResponse(response: Response): Promise<Empty> {
    if (!this.responder) throw new Error(`Responder not active`); // TODO: Clarify

    response.setClientid(this.settings.client);
    return this.responder.sendResponse(response);
  }
}
