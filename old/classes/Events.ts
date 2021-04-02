import { Validator } from '../interfaces';
import * as pb from '../../src/protos';
import { Utils } from '../../src/utils';
import { ClientReadableStream } from '@grpc/grpc-js';
export class Event implements Validator {
  id = '';
  channel = '';
  metadata = '';
  body: Uint8Array | string;
  clientId = '';
  tags: Map<string, string>;
  setId(value: string): Event {
    this.id = value;
    return this;
  }
  setChannel(value: string): Event {
    this.channel = value;
    return this;
  }
  setMetadata(value: string): Event {
    this.metadata = value;
    return this;
  }
  setBody(value: Uint8Array | string): Event {
    this.body = value;
    return this;
  }
  setClientId(value: string): Event {
    this.clientId = value;
    return this;
  }
  setTags(value: Map<string, string>): Event {
    this.tags = value;
    return this;
  }
  constructor() {}
  toPB(): pb.Event {
    let event = new pb.Event();
    if (this.id === '') {
      this.id = Utils.uuid();
    }
    if (this.clientId === '') {
      this.clientId = Utils.uuid();
    }
    event.setEventid(this.id);
    event.setClientid(this.clientId);
    event.setMetadata(this.metadata);
    event.setBody(this.body);
    event.setChannel(this.channel);
    event.setStore(false);
    return event;
  }
  validate(): boolean | string {
    return true;
  }
}

export class EventResult {
  readonly sent: boolean;
  readonly id: string;
  constructor(id: string) {
    this.id = id;
    this.sent = true;
  }
}

export class EventReceive {
  readonly id: string;
  readonly channel: string;
  readonly metadata: string;
  readonly body: Uint8Array | string;
  readonly tags: Map<string, string>;
  constructor(protected ev: pb.EventReceive) {
    this.id = ev.getEventid();
    this.channel = ev.getChannel();
    this.metadata = ev.getMetadata();
    this.body = ev.getBody();
    this.tags = ev.getTagsMap();
  }
}
export class EventsSubscriptionRequest {
  setClientId(value: string): EventsSubscriptionRequest {
    this.clientId = value;
    return this;
  }
  toPB(clientId: string): pb.Subscribe {
    let sub = new pb.Subscribe();
    sub.setChannel(this.channel);
    sub.setGroup(this.group);
    sub.setSubscribetypedata(1);
    if (this.clientId) {
      if (this.clientId === '') {
        this.clientId = clientId;
      }
    } else {
      this.clientId = clientId;
    }
    sub.setClientid(this.clientId);
    return sub;
  }
  constructor(
    public channel: string,
    public group: string,
    public clientId?: string,
  ) {}
}
export class EventsSubscriber {
  public stream?: ClientReadableStream<pb.EventReceive>;
  public state: string;
  setState(value: string): void {
    this.state = value;
  }
  constructor() {
    this.state = 'initialized';
  }
  stop() {
    if (this.stream) {
      this.stream?.cancel();
    }
  }
}
