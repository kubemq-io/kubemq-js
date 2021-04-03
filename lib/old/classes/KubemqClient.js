"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KubemqClient = void 0;
const tslib_1 = require("tslib");
const grpc_js_1 = require("@grpc/grpc-js");
const protos_1 = require("../../src/protos");
const wrrappers_1 = require("./wrrappers");
const protos_2 = require("../../src/protos");
const Events_1 = require("./Events");
class KubemqClient {
    constructor(settings) {
        this.settings = settings;
        this.grpcClient = this.createClient();
    }
    createClient() {
        let client;
        client = new protos_1.kubemqClient(this.settings.address, grpc_js_1.credentials.createInsecure());
        const deadline = new Date();
        deadline.setSeconds(deadline.getSeconds() + 1);
        client.waitForReady(deadline, (err) => {
            if (err) {
                console.error('not-ready', err);
            }
            else {
                console.log('is ready');
            }
        });
        return client;
    }
    close() {
        this.grpcClient.close();
    }
    ping() {
        return new Promise((resolve, reject) => {
            this.grpcClient.ping(new protos_2.Empty(), (e, res) => {
                if (e)
                    reject(e);
                resolve(new wrrappers_1.PingResult(res));
            });
        });
    }
    sendEvent(event) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (event.clientId === '') {
                event.clientId = this.settings.clientId;
            }
            return new Promise((resolve, reject) => {
                this.grpcClient.sendEvent(event.toPB(), (e) => {
                    if (e)
                        reject(e);
                    resolve(new Events_1.EventResult(event.id));
                });
            });
        });
    }
    subscribeToEvents(subRequest, reqHandler, errorHandler, stateHandler) {
        const eventsSubscriber = new Events_1.EventsSubscriber();
        eventsSubscriber.stream = this.grpcClient.subscribeToEvents(subRequest.toPB(this.settings.clientId));
        eventsSubscriber.setState('ready');
        if (stateHandler) {
            stateHandler('ready');
        }
        eventsSubscriber.stream.on('error', function (e) {
            errorHandler(e);
            eventsSubscriber.setState('error');
            if (stateHandler) {
                stateHandler('error');
            }
        });
        eventsSubscriber.stream.on('data', function (data) {
            reqHandler(new Events_1.EventReceive(data));
        });
        eventsSubscriber.stream.on('end', function () {
            eventsSubscriber.setState('end');
            if (stateHandler) {
                stateHandler('end');
            }
        });
        return eventsSubscriber;
    }
}
exports.KubemqClient = KubemqClient;
//# sourceMappingURL=KubemqClient.js.map