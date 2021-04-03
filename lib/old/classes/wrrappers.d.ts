import * as pb from '../../src/protos';
export declare class PingResult {
    protected _result: pb.PingResult;
    readonly host: string;
    readonly version: string;
    readonly serverStartTime: number;
    readonly serverUpTimeSeconds: number;
    constructor(_result: pb.PingResult);
}
//# sourceMappingURL=wrrappers.d.ts.map