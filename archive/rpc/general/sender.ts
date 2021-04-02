import { RPC } from '../rpc';
import { Request, Response } from '../../../src/protos';
import { Settings } from '../../interfaces';

export class GeneralSender extends RPC {
  constructor(settings: Settings) {
    super(settings);
  }

  send(request: Request): Promise<Response> {
    return super.send(request);
  }
}
