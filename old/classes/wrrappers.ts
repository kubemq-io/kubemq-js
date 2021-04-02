import * as pb from '../../src/protos';
export class PingResult {
  readonly host: string;
  readonly version: string;
  readonly serverStartTime: number;
  readonly serverUpTimeSeconds: number;
  constructor(protected _result: pb.PingResult) {
    this.host = this._result.getHost();
    this.version = this._result.getVersion();
    this.serverStartTime = this._result.getServerstarttime();
    this.serverUpTimeSeconds = this._result.getServeruptimeseconds();
  }
}
