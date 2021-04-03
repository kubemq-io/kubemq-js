"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventsStoreClient = exports.EventStoreType = void 0;
const client_1 = require("./client");
const pb = require("../src/protos");
const utils_1 = require("./utils");
const common_1 = require("./common");
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
                if (e) {
                    reject(e);
                    return;
                }
                if (result != null)
                    resolve({
                        id: result.getEventid(),
                        sent: result.getSent(),
                        error: result.getError(),
                    });
            });
        });
    }
    stream() {
        const stream = this.grpcClient.sendEventsStream(this.metadata());
        let state = client_1.StreamState.Initialized;
        const onStateChanged = new common_1.TypedEvent();
        const onError = new common_1.TypedEvent();
        const onResult = new common_1.TypedEvent();
        stream.on('data', function (result) {
            onResult.emit({
                id: result.getEventid(),
                sent: result.getSent(),
                error: result.getError(),
            });
            if (state !== client_1.StreamState.Ready) {
                state = client_1.StreamState.Ready;
                onStateChanged.emit(client_1.StreamState.Ready);
            }
        });
        stream.on('error', function (e) {
            onError.emit(e);
            if (state !== client_1.StreamState.Error) {
                state = client_1.StreamState.Error;
                onStateChanged.emit(client_1.StreamState.Error);
            }
        });
        stream.on('close', function () {
            if (state !== client_1.StreamState.Closed) {
                state = client_1.StreamState.Closed;
                onStateChanged.emit(client_1.StreamState.Closed);
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
        return {
            onResult,
            onError: onError,
            onStateChanged: onStateChanged,
            state: state,
            write: writeFn,
            cancel() {
                stream.cancel();
            },
            end() {
                stream.end();
            },
        };
    }
    subscribe(request) {
        const pbSubRequest = new pb.Subscribe();
        pbSubRequest.setClientid(request.clientId ? request.clientId : this.clientOptions.clientId);
        pbSubRequest.setGroup(request.group ? request.group : '');
        pbSubRequest.setChannel(request.channel);
        pbSubRequest.setSubscribetypedata(2);
        pbSubRequest.setEventsstoretypedata(request.requestType ? request.requestType : 1);
        pbSubRequest.setEventsstoretypevalue(request.requestTypeValue ? request.requestTypeValue : 0);
        const stream = this.grpcClient.subscribeToEvents(pbSubRequest, this.metadata());
        let state = client_1.StreamState.Initialized;
        let onStateChanged = new common_1.TypedEvent();
        let onEvent = new common_1.TypedEvent();
        let onError = new common_1.TypedEvent();
        stream.on('data', function (data) {
            onEvent.emit({
                id: data.getEventid(),
                channel: data.getChannel(),
                metadata: data.getMetadata(),
                body: data.getBody(),
                tags: data.getTagsMap(),
                timestamp: data.getTimestamp(),
                sequence: data.getSequence(),
            });
            if (state !== client_1.StreamState.Ready) {
                state = client_1.StreamState.Ready;
                onStateChanged.emit(client_1.StreamState.Ready);
            }
        });
        stream.on('error', function (e) {
            onError.emit(e);
            if (state !== client_1.StreamState.Error) {
                state = client_1.StreamState.Error;
                onStateChanged.emit(client_1.StreamState.Error);
            }
        });
        stream.on('close', function () {
            if (state !== client_1.StreamState.Closed) {
                state = client_1.StreamState.Closed;
                onStateChanged.emit(client_1.StreamState.Closed);
            }
        });
        return {
            state: state,
            onEvent: onEvent,
            onStateChanged: onStateChanged,
            onError: onError,
            cancel() {
                stream.cancel();
            },
        };
    }
}
exports.EventsStoreClient = EventsStoreClient;
//# sourceMappingURL=events_store.js.map