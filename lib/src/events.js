"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventsClient = void 0;
const client_1 = require("./client");
const pb = require("../src/protos");
const utils_1 = require("./utils");
class EventsClient extends client_1.Client {
    constructor(Options) {
        super(Options);
    }
    send(message) {
        const pbMessage = new pb.Event();
        pbMessage.setEventid(message.id ? message.id : utils_1.Utils.uuid());
        pbMessage.setClientid(message.clientId ? message.clientId : this.clientOptions.clientId);
        pbMessage.setChannel(message.channel);
        pbMessage.setBody(message.body);
        pbMessage.setMetadata(message.metadata);
        if (message.tags != null) {
            pbMessage.getTagsMap().set(message.tags);
        }
        pbMessage.setStore(false);
        return new Promise((resolve, reject) => {
            this.grpcClient.sendEvent(pbMessage, this.metadata(), this.callOptions(), (e) => {
                if (e)
                    reject(e);
                resolve({ id: pbMessage.getEventid(), sent: true });
            });
        });
    }
    stream(request) {
        const stream = this.grpcClient.sendEventsStream(this.metadata(), this.callOptions());
        stream.on('error', function (e) {
            if (request.onErrorFn != null) {
                request.onErrorFn(e);
            }
        });
        stream.on('close', function () {
            if (request.onCloseFn != null) {
                request.onCloseFn();
            }
        });
        const clientIdFromOptions = this.clientOptions.clientId;
        const writeFn = function (message) {
            const pbMessage = new pb.Event();
            pbMessage.setEventid(message.id ? message.id : utils_1.Utils.uuid());
            pbMessage.setClientid(message.clientId ? message.clientId : clientIdFromOptions);
            pbMessage.setChannel(message.channel);
            pbMessage.setBody(message.body);
            pbMessage.setMetadata(message.metadata);
            if (message.tags != null) {
                pbMessage.getTagsMap().set(message.tags);
            }
            pbMessage.setStore(false);
            stream.write(pbMessage);
        };
        return { write: writeFn, cancel: stream.cancel, end: stream.end };
    }
    subscribe(request) {
        const pbSubRequest = new pb.Subscribe();
        pbSubRequest.setClientid(request.clientId ? request.clientId : this.clientOptions.clientId);
        pbSubRequest.setGroup(request.group ? request.group : '');
        pbSubRequest.setChannel(request.channel);
        pbSubRequest.setSubscribetypedata(1);
        const stream = this.grpcClient.subscribeToEvents(pbSubRequest, this.metadata(), this.callOptions());
        stream.on('data', function (data) {
            if (request.onEventFn != null) {
                request.onEventFn({
                    id: data.getEventid(),
                    channel: data.getChannel(),
                    metadata: data.getMetadata(),
                    body: data.getBody(),
                    tags: data.getTagsMap(),
                });
            }
        });
        stream.on('error', function (e) {
            if (request.onErrorFn != null) {
                request.onErrorFn(e);
            }
        });
        stream.on('close', function () {
            if (request.onCloseFn != null) {
                request.onCloseFn();
            }
        });
        return { cancel: stream.cancel };
    }
}
exports.EventsClient = EventsClient;
//# sourceMappingURL=events.js.map