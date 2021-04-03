"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventsStoreClient = exports.EventStoreType = void 0;
const client_1 = require("./client");
const pb = require("../src/protos");
const utils_1 = require("./utils");
var EventStoreType;
(function (EventStoreType) {
    EventStoreType[EventStoreType["StartNewOnly"] = 1] = "StartNewOnly";
    EventStoreType[EventStoreType["StartFromFirst"] = 2] = "StartFromFirst";
    EventStoreType[EventStoreType["StartFromLast"] = 3] = "StartFromLast";
    EventStoreType[EventStoreType["StartAtSequence"] = 4] = "StartAtSequence";
    EventStoreType[EventStoreType["StartAtTime"] = 5] = "StartAtTime";
    EventStoreType[EventStoreType["StartAtTimeDelta"] = 6] = "StartAtTimeDelta";
})(EventStoreType = exports.EventStoreType || (exports.EventStoreType = {}));
class EventsStoreClient extends client_1.Client {
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
        pbMessage.setStore(true);
        return new Promise((resolve, reject) => {
            this.grpcClient.sendEvent(pbMessage, this.metadata(), this.callOptions(), (e, result) => {
                if (e)
                    reject(e);
                if (result != null)
                    resolve({
                        id: result.getEventid(),
                        sent: result.getSent(),
                        error: result.getError(),
                    });
            });
        });
    }
    stream(request) {
        const stream = this.grpcClient.sendEventsStream(this.metadata(), this.callOptions());
        stream.on('data', function (result) {
            if (request.onResultFn != null) {
                request.onResultFn({
                    id: result.getEventid(),
                    sent: result.getSent(),
                    error: result.getError(),
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
            pbMessage.setStore(true);
            stream.write(pbMessage);
        };
        return { write: writeFn, cancel: stream.cancel, end: stream.end };
    }
    subscribe(request) {
        const pbSubRequest = new pb.Subscribe();
        pbSubRequest.setClientid(request.clientId ? request.clientId : this.clientOptions.clientId);
        pbSubRequest.setGroup(request.group ? request.group : '');
        pbSubRequest.setChannel(request.channel);
        pbSubRequest.setSubscribetypedata(2);
        pbSubRequest.setEventsstoretypedata(request.requestType ? request.requestType : 1);
        pbSubRequest.setEventsstoretypevalue(request.requestTypeValue ? request.requestTypeValue : 0);
        const stream = this.grpcClient.subscribeToEvents(pbSubRequest, this.metadata(), this.callOptions());
        stream.on('data', function (data) {
            if (request.onEventFn != null) {
                request.onEventFn({
                    id: data.getEventid(),
                    channel: data.getChannel(),
                    metadata: data.getMetadata(),
                    body: data.getBody(),
                    tags: data.getTagsMap(),
                    timestamp: data.getTimestamp(),
                    sequence: data.getSequence(),
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
exports.EventsStoreClient = EventsStoreClient;
//# sourceMappingURL=events_store.js.map