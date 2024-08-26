"use strict";
exports.__esModule = true;
exports.Utils = void 0;
var uuid_1 = require("uuid");
var Utils = /** @class */ (function () {
    function Utils() {
        throw new Error("This class can't be initialized.");
    }
    Utils.uuid = function () {
        return (0, uuid_1.v4)();
    };
    Utils.stringToBytes = function (str) {
        return Buffer.from(str);
    };
    Utils.bytesToString = function (bytes) {
        if (typeof bytes === 'string') {
            return bytes;
        }
        return String.fromCharCode.apply(null, bytes);
    };
    return Utils;
}());
exports.Utils = Utils;
