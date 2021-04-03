"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("../../client");
function main() {
    const opts = {
        address: 'localhost:50000',
    };
    const client = new client_1.Client(opts);
    client
        .ping()
        .then((value) => console.log(value))
        .catch((reason) => console.log(reason));
}
main();
//# sourceMappingURL=basic.js.map