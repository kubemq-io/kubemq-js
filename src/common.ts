import * as pb from './protos';
import { Utils } from './utils';
import * as kubemq from './protos';
import * as grpc from '@grpc/grpc-js';

export function createChannel(
  client: kubemq.kubemqClient,
  md: grpc.Metadata,
  clientId: string,
  channelName: string,
  channelType: string,
): Promise<void> {
  const pbMessage = new pb.Request();
  pbMessage.setRequestid(Utils.uuid());
  pbMessage.setClientid(clientId);
  pbMessage.setRequesttypedata(2);
  pbMessage.setChannel('kubemq.cluster.internal.requests');
  pbMessage.setMetadata('create-channel');
  const pbtags = pbMessage.getTagsMap();
  pbtags.set('channel_type', channelType);
  pbtags.set('channel', channelName);
  pbtags.set('client_id', clientId);
  pbMessage.setTimeout(10000);
  return new Promise<void>((resolve, reject) => {
    client.sendRequest(pbMessage, md, (e) => {
      if (e) {
        reject(e);
        return;
      }
      resolve();
    });
  });
}
