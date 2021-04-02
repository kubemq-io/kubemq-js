import { BaseMessage, Client } from './client';
import { Config } from './config';
import * as pb from '../src/protos';
import { Utils } from './utils';
export interface EventsMessage extends BaseMessage {}
export interface EventsSendResult {
  id: string;
  sent: boolean;
}

export interface EventsSubscriptionRequest {
  channel: string;
  group?: string;
  clientId?: string;
}
export class EventsClient extends Client {
  constructor(Options: Config) {
    super(Options);
  }

  public send(message: EventsMessage): Promise<EventsSendResult> {
    const pbMessage = new pb.Event();
    pbMessage.setEventid(message.id ? message.id : Utils.uuid());
    pbMessage.setClientid(
      message.clientId ? message.clientId : this.clientOptions.clientId,
    );
    pbMessage.setChannel(message.channel);
    pbMessage.setBody(message.body);
    pbMessage.setMetadata(message.metadata);
    pbMessage.getTagsMap().set(message.tags);
    pbMessage.setStore(false);
    return new Promise<EventsSendResult>((resolve, reject) => {
      this.grpcClient.sendEvent(pbMessage, (e) => {
        if (e) reject(e);
        resolve({ id: pbMessage.getEventid(), sent: true });
      });
    });
  }

  // public subscribe(
  //   request: EventsSubscriptionRequest,
  // ): Promise<ResponseStream<pb.EventReceive>> {}
}
const opts: Config = {
  address: 'localhost:50000',
  clientId: Utils.uuid(),
};
const eventsClient = new EventsClient(opts);

eventsClient
  .send({ id: 'some', channel: 'events', body: 'data' })
  .then(console.log)
  .catch(console.error);
