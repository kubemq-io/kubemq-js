"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandsClient = void 0;
const client_1 = require("./client");
const pb = require("../src/protos");
const utils_1 = require("./utils");
const common_1 = require("./common");
class CommandsClient extends client_1.Client {
    constructor(Options) {
        super(Options);
    }
    send(message) {
        const pbMessage = new pb.Request();
        pbMessage.setRequestid(message.id ? message.id : utils_1.Utils.uuid());
        pbMessage.setClientid(message.clientId ? message.clientId : this.clientOptions.clientId);
        pbMessage.setChannel(message.channel);
        pbMessage.setReplychannel(message.channel);
        pbMessage.setBody(message.body);
        pbMessage.setMetadata(message.metadata);
        if (message.tags != null) {
            pbMessage.getTagsMap().set(message.tags);
        }
        pbMessage.setTimeout(message.timeout ? message.timeout : this.clientOptions.defaultRpcTimeout);
        pbMessage.setRequesttypedata(1);
        return new Promise((resolve, reject) => {
            this.grpcClient.sendRequest(pbMessage, this.metadata(), (e, response) => {
                if (e) {
                    reject(e);
                    return;
                }
                resolve({
                    id: response.getRequestid(),
                    clientId: response.getClientid(),
                    error: response.getError(),
                    executed: response.getExecuted(),
                    timestamp: response.getTimestamp(),
                });
            });
        });
    }
    response(message) {
        const pbMessage = new pb.Response();
        pbMessage.setRequestid(message.id);
        pbMessage.setClientid(message.clientId ? message.clientId : this.clientOptions.clientId);
        pbMessage.setReplychannel(message.replyChannel);
        pbMessage.setError(message.error);
        pbMessage.setExecuted(message.executed);
        return new Promise((resolve, reject) => {
            this.grpcClient.sendResponse(pbMessage, this.metadata(), (e, response) => {
                if (e) {
                    reject(e);
                    return;
                }
                resolve(response);
            });
        });
    }
    subscribe(request) {
        const pbSubRequest = new pb.Subscribe();
        pbSubRequest.setClientid(request.clientId ? request.clientId : this.clientOptions.clientId);
        pbSubRequest.setGroup(request.group ? request.group : '');
        pbSubRequest.setChannel(request.channel);
        pbSubRequest.setSubscribetypedata(3);
        const stream = this.grpcClient.subscribeToRequests(pbSubRequest, this.metadata());
        let state = client_1.StreamState.Initialized;
        let onStateChanged = new common_1.TypedEvent();
        let onCommand = new common_1.TypedEvent();
        let onError = new common_1.TypedEvent();
        stream.on('data', function (data) {
            onCommand.emit({
                id: data.getRequestid(),
                channel: data.getChannel(),
                metadata: data.getMetadata(),
                body: data.getBody(),
                tags: data.getTagsMap(),
                replyChannel: data.getReplychannel(),
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
            onCommand: onCommand,
            onStateChanged: onStateChanged,
            onError: onError,
            cancel() {
                stream.cancel();
            },
        };
    }
}
exports.CommandsClient = CommandsClient;
//# sourceMappingURL=commands.js.map