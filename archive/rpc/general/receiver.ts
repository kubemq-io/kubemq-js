import { RPC } from '../rpc';
import { Empty, Request, Response } from '../../../src/protos';
import { Settings } from '../../interfaces';

export class GeneralReceiver extends RPC {
  constructor(settings: Settings) {
    super(settings);
  }

  subscribe(
    reqHandler: (...args: any[]) => void,
    errorHandler: (...args: any[]) => void,
  ) {
    super.subscribe(reqHandler, errorHandler);
  }

  unsubscribe() {
    super.unsubscribe();
  }

  async sendResponse(response: Response): Promise<Empty> {
    return super.sendResponse(response);
  }

  async ack(cmd: Request, res: Response = new Response()): Promise<Empty> {
    res.setRequestid(cmd.getRequestid());
    res.setReplychannel(cmd.getReplychannel());

    return this.sendResponse(res);
  }
}
