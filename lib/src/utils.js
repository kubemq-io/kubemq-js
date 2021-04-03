"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Utils = void 0;
const uuid_1 = require("uuid");
class Utils {
    constructor() {
        throw new Error(`This class can't be initialized.`);
    }
    static uuid() {
        return uuid_1.v4();
    }
    static stringToBytes(str) {
        return Buffer.from(str);
    }
    static bytesToString(bytes) {
        const chars = [];
        for (let i = 0, n = bytes.length; i < n;) {
            chars.push(((bytes[i++] & 0xff) << 8) | (bytes[i++] & 0xff));
        }
        return String.fromCharCode.apply(null, chars);
    }
}
exports.Utils = Utils;
//# sourceMappingURL=utils.js.map