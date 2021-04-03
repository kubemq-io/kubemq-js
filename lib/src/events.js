"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventsClient = void 0;
const client_1 = require("./client");
const pb = require("../src/protos");
const utils_1 = require("./utils");
const common_1 = require("./common");
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
                if (e) {
                    reject(e);
                    return;
                }
                resolve({ id: pbMessage.getEventid(), sent: true });
            });
        });
    }
    stream() {
        const stream = this.grpcClient.sendEventsStream(this.metadata());
        let state = client_1.StreamState.Initialized;
        const onStateChanged = new common_1.TypedEvent();
        const onError = new common_1.TypedEvent();
        const onResult = new common_1.TypedEvent();
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
            pbMessage.setStore(false);
            stream.write(pbMessage);
            if (state !== client_1.StreamState.Ready) {
                state = client_1.StreamState.Ready;
                onStateChanged.emit(client_1.StreamState.Ready);
            }
            onResult.emit({
                id: pbMessage.getEventid(),
                sent: true,
            });
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
        pbSubRequest.setSubscribetypedata(1);
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
exports.EventsClient = EventsClient;
//# sourceMappingURL=events.js.map