"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Settings = void 0;
class Settings {
    constructor(_address) {
        this._address = _address;
        this.clientId = '';
    }
    setClientId(value) {
        this.clientId = value;
        return this;
    }
    get address() {
        return this._address;
    }
}
exports.Settings = Settings;
//# sourceMappingURL=Settings.js.map