"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PingResult = void 0;
class PingResult {
    constructor(_result) {
        this._result = _result;
        this.host = this._result.getHost();
        this.version = this._result.getVersion();
        this.serverStartTime = this._result.getServerstarttime();
        this.serverUpTimeSeconds = this._result.getServeruptimeseconds();
    }
}
exports.PingResult = PingResult;
//# sourceMappingURL=wrrappers.js.map