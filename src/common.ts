import * as pb from './protos';
import { Utils } from './utils';
import * as kubemq from './protos';
import * as grpc from '@grpc/grpc-js';
import {
  PubSubChannel,
  PubSubStats,
  QueuesChannel,
  QueuesStats,
  CQChannel,
  CQStats,
} from './channel_stats';

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

export function deleteChannel(
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
  pbMessage.setMetadata('delete-channel');
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

export function listPubSubChannels(
  client: kubemq.kubemqClient,
  md: grpc.Metadata,
  clientId: string,
  search: string,
  channelType: string,
): Promise<PubSubChannel[]> {
  const pbMessage = new pb.Request();
  pbMessage.setRequestid(Utils.uuid());
  pbMessage.setClientid(clientId);
  pbMessage.setRequesttypedata(2);
  pbMessage.setChannel('kubemq.cluster.internal.requests');
  pbMessage.setMetadata('list-channels');
  const pbtags = pbMessage.getTagsMap();
  pbtags.set('client_id', clientId);
  pbtags.set('channel_type', channelType);
  pbtags.set('channel_search', search);
  pbMessage.setTimeout(10000);
  return new Promise<PubSubChannel[]>((resolve, reject) => {
    client.sendRequest(pbMessage, md, (e, data) => {
      if (e) {
        reject(e);
        return;
      }
      if (!data) {
        reject(new Error('no data'));
        return;
      }
      if (data.getBody() === null) {
        resolve([]);
        return;
      }
      const channels = decodePubSubChannelList(data.getBody_asU8());
      resolve(channels);
    });
  });
}

export function listQueuesChannels(
  client: kubemq.kubemqClient,
  md: grpc.Metadata,
  clientId: string,
  search: string,
  channelType: string,
): Promise<QueuesChannel[]> {
  const pbMessage = new pb.Request();
  pbMessage.setRequestid(Utils.uuid());
  pbMessage.setClientid(clientId);
  pbMessage.setRequesttypedata(2);
  pbMessage.setChannel('kubemq.cluster.internal.requests');
  pbMessage.setMetadata('list-channels');
  const pbtags = pbMessage.getTagsMap();
  pbtags.set('client_id', clientId);
  pbtags.set('channel_type', channelType);
  pbtags.set('channel_search', search);
  pbMessage.setTimeout(10000);
  return new Promise<QueuesChannel[]>((resolve, reject) => {
    client.sendRequest(pbMessage, md, (e, data) => {
      if (e) {
        reject(e);
        return;
      }
      if (!data) {
        reject(new Error('no data'));
        return;
      }
      if (data.getBody() === null) {
        resolve([]);
        return;
      }
      const channels = decodeQueuesChannelList(data.getBody_asU8());
      resolve(channels);
    });
  });
}

export function listCQChannels(
  client: kubemq.kubemqClient,
  md: grpc.Metadata,
  clientId: string,
  search: string,
  channelType: string,
): Promise<CQChannel[]> {
  const pbMessage = new pb.Request();
  pbMessage.setRequestid(Utils.uuid());
  pbMessage.setClientid(clientId);
  pbMessage.setRequesttypedata(2);
  pbMessage.setChannel('kubemq.cluster.internal.requests');
  pbMessage.setMetadata('list-channels');
  const pbtags = pbMessage.getTagsMap();
  pbtags.set('client_id', clientId);
  pbtags.set('channel_type', channelType);
  pbtags.set('channel_search', search);
  pbMessage.setTimeout(10000);
  return new Promise<CQChannel[]>((resolve, reject) => {
    client.sendRequest(pbMessage, md, (e, data) => {
      if (e) {
        reject(e);
        return;
      }
      if (!data) {
        reject(new Error('no data'));
        return;
      }
      if (data.getBody() === null) {
        resolve([]);
        return;
      }
      const channels = decodeCQChannelList(data.getBody_asU8());
      resolve(channels);
    });
  });
}

function decodePubSubChannelList(dataBytes: Uint8Array): PubSubChannel[] {
  /**
   * Decodes the given data bytes into a list of PubSubChannel objects.
   *
   * @param dataBytes The data bytes to decode.
   * @returns A list of PubSubChannel objects.
   */
  // Decode bytes to string and parse JSON
  const dataStr = new TextDecoder().decode(dataBytes);
  const channelsData = JSON.parse(dataStr);

  const channels: PubSubChannel[] = [];
  for (const item of channelsData) {
    // Extracting incoming and outgoing as Stats objects
    const incoming: PubSubStats = item['incoming'];
    const outgoing: PubSubStats = item['outgoing'];

    // Creating a Channel instance with the Stats objects
    const channel: PubSubChannel = {
      name: item['name'],
      type: item['type'],
      lastActivity: item['lastActivity'],
      isActive: item['isActive'],
      incoming,
      outgoing,
    };
    channels.push(channel);
  }

  return channels;
}

function decodeQueuesChannelList(dataBytes: Uint8Array): QueuesChannel[] {
  /**
   * Decodes a byte string into a list of QueuesChannel objects.
   *
   * @param dataBytes The byte string to be decoded.
   * @returns A list of QueuesChannel objects.
   *
   * Note:
   * - This method assumes that the byte string is encoded in 'utf-8' format.
   * - The byte string should represent a valid JSON object.
   * - The JSON object should contain the necessary fields ('name', 'type', 'lastActivity', 'isActive', 'incoming', 'outgoing') for creating QueuesChannel objects.
   * - The 'incoming' and 'outgoing' fields should contain valid JSON objects that can be parsed into QueuesStats objects.
   */
  // Decode bytes to string and parse JSON
  const dataStr = new TextDecoder().decode(dataBytes);
  const channelsData = JSON.parse(dataStr);

  const channels: QueuesChannel[] = [];
  for (const item of channelsData) {
    // Extracting incoming and outgoing as Stats objects
    const incoming: QueuesStats = item['incoming'];
    const outgoing: QueuesStats = item['outgoing'];

    // Creating a Channel instance with the Stats objects
    const channel: QueuesChannel = {
      name: item['name'],
      type: item['type'],
      lastActivity: item['lastActivity'],
      isActive: item['isActive'],
      incoming,
      outgoing,
    };
    channels.push(channel);
  }

  return channels;
}

function decodeCQChannelList(dataBytes: Uint8Array): CQChannel[] {
  /**
   * Decodes the given byte array into a list of CQChannel objects.
   *
   * @param dataBytes The byte array to decode.
   * @returns The list of CQChannel objects decoded from the byte array.
   */
  // Decode bytes to string and parse JSON
  const dataStr = new TextDecoder().decode(dataBytes);
  const channelsData = JSON.parse(dataStr);

  const channels: CQChannel[] = [];
  for (const item of channelsData) {
    // Extracting incoming and outgoing as Stats objects
    const incoming: CQStats = item['incoming'];
    const outgoing: CQStats = item['outgoing'];

    // Creating a Channel instance with the Stats objects
    const channel: CQChannel = {
      name: item['name'],
      type: item['type'],
      lastActivity: item['lastActivity'],
      isActive: item['isActive'],
      incoming,
      outgoing,
    };
    channels.push(channel);
  }

  return channels;
}
