"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventsSubscriber = exports.EventsSubscriptionRequest = exports.EventReceive = exports.EventResult = exports.Event = void 0;
const pb = require("../../src/protos");
const utils_1 = require("../../src/utils");
class Event {
    constructor() {
        this.id = '';
        this.channel = '';
        this.metadata = '';
        this.clientId = '';
    }
    setId(value) {
        this.id = value;
        return this;
    }
    setChannel(value) {
        this.channel = value;
        return this;
    }
    setMetadata(value) {
        this.metadata = value;
        return this;
    }
    setBody(value) {
        this.body = value;
        return this;
    }
    setClientId(value) {
        this.clientId = value;
        return this;
    }
    setTags(value) {
        this.tags = value;
        return this;
    }
    toPB() {
        let event = new pb.Event();
        if (this.id === '') {
            this.id = utils_1.Utils.uuid();
        }
        if (this.clientId === '') {
            this.clientId = utils_1.Utils.uuid();
        }
        event.setEventid(this.id);
        event.setClientid(this.clientId);
        event.setMetadata(this.metadata);
        event.setBody(this.body);
        event.setChannel(this.channel);
        event.setStore(false);
        return event;
    }
    validate() {
        return true;
    }
}
exports.Event = Event;
class EventResult {
    constructor(id) {
        this.id = id;
        this.sent = true;
    }
}
exports.EventResult = EventResult;
class EventReceive {
    constructor(ev) {
        this.ev = ev;
        this.id = ev.getEventid();
        this.channel = ev.getChannel();
        this.metadata = ev.getMetadata();
        this.body = ev.getBody();
        this.tags = ev.getTagsMap();
    }
}
exports.EventReceive = EventReceive;
class EventsSubscriptionRequest {
    constructor(channel, group, clientId) {
        this.channel = channel;
        this.group = group;
        this.clientId = clientId;
    }
    setClientId(value) {
        this.clientId = value;
        return this;
    }
    toPB(clientId) {
        let sub = new pb.Subscribe();
        sub.setChannel(this.channel);
        sub.setGroup(this.group);
        sub.setSubscribetypedata(1);
        if (this.clientId) {
            if (this.clientId === '') {
                this.clientId = clientId;
            }
        }
        else {
            this.clientId = clientId;
        }
        sub.setClientid(this.clientId);
        return sub;
    }
}
exports.EventsSubscriptionRequest = EventsSubscriptionRequest;
class EventsSubscriber {
    constructor() {
        this.state = 'initialized';
    }
    setState(value) {
        this.state = value;
    }
    stop() {
        var _a;
        if (this.stream) {
            (_a = this.stream) === null || _a === void 0 ? void 0 : _a.cancel();
        }
    }
}
exports.EventsSubscriber = EventsSubscriber;
//# sourceMappingURL=Events.js.map