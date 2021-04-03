// package: kubemq
// file: src/protos/grpc/kubemq.proto

import * as jspb from "google-protobuf";

export class PingResult extends jspb.Message {
  getHost(): string;
  setHost(value: string): void;

  getVersion(): string;
  setVersion(value: string): void;

  getServerstarttime(): number;
  setServerstarttime(value: number): void;

  getServeruptimeseconds(): number;
  setServeruptimeseconds(value: number): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): PingResult.AsObject;
  static toObject(includeInstance: boolean, msg: PingResult): PingResult.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: PingResult, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): PingResult;
  static deserializeBinaryFromReader(message: PingResult, reader: jspb.BinaryReader): PingResult;
}

export namespace PingResult {
  export type AsObject = {
    host: string,
    version: string,
    serverstarttime: number,
    serveruptimeseconds: number,
  }
}

export class Empty extends jspb.Message {
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Empty.AsObject;
  static toObject(includeInstance: boolean, msg: Empty): Empty.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: Empty, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): Empty;
  static deserializeBinaryFromReader(message: Empty, reader: jspb.BinaryReader): Empty;
}

export namespace Empty {
  export type AsObject = {
  }
}

export class Result extends jspb.Message {
  getEventid(): string;
  setEventid(value: string): void;

  getSent(): boolean;
  setSent(value: boolean): void;

  getError(): string;
  setError(value: string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Result.AsObject;
  static toObject(includeInstance: boolean, msg: Result): Result.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: Result, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): Result;
  static deserializeBinaryFromReader(message: Result, reader: jspb.BinaryReader): Result;
}

export namespace Result {
  export type AsObject = {
    eventid: string,
    sent: boolean,
    error: string,
  }
}

export class Event extends jspb.Message {
  getEventid(): string;
  setEventid(value: string): void;

  getClientid(): string;
  setClientid(value: string): void;

  getChannel(): string;
  setChannel(value: string): void;

  getMetadata(): string;
  setMetadata(value: string): void;

  getBody(): Uint8Array | string;
  getBody_asU8(): Uint8Array;
  getBody_asB64(): string;
  setBody(value: Uint8Array | string): void;

  getStore(): boolean;
  setStore(value: boolean): void;

  getTagsMap(): jspb.Map<string, string>;
  clearTagsMap(): void;
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Event.AsObject;
  static toObject(includeInstance: boolean, msg: Event): Event.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: Event, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): Event;
  static deserializeBinaryFromReader(message: Event, reader: jspb.BinaryReader): Event;
}

export namespace Event {
  export type AsObject = {
    eventid: string,
    clientid: string,
    channel: string,
    metadata: string,
    body: Uint8Array | string,
    store: boolean,
    tagsMap: Array<[string, string]>,
  }
}

export class EventReceive extends jspb.Message {
  getEventid(): string;
  setEventid(value: string): void;

  getChannel(): string;
  setChannel(value: string): void;

  getMetadata(): string;
  setMetadata(value: string): void;

  getBody(): Uint8Array | string;
  getBody_asU8(): Uint8Array;
  getBody_asB64(): string;
  setBody(value: Uint8Array | string): void;

  getTimestamp(): number;
  setTimestamp(value: number): void;

  getSequence(): number;
  setSequence(value: number): void;

  getTagsMap(): jspb.Map<string, string>;
  clearTagsMap(): void;
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): EventReceive.AsObject;
  static toObject(includeInstance: boolean, msg: EventReceive): EventReceive.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: EventReceive, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): EventReceive;
  static deserializeBinaryFromReader(message: EventReceive, reader: jspb.BinaryReader): EventReceive;
}

export namespace EventReceive {
  export type AsObject = {
    eventid: string,
    channel: string,
    metadata: string,
    body: Uint8Array | string,
    timestamp: number,
    sequence: number,
    tagsMap: Array<[string, string]>,
  }
}

export class Subscribe extends jspb.Message {
  getSubscribetypedata(): Subscribe.SubscribeTypeMap[keyof Subscribe.SubscribeTypeMap];
  setSubscribetypedata(value: Subscribe.SubscribeTypeMap[keyof Subscribe.SubscribeTypeMap]): void;

  getClientid(): string;
  setClientid(value: string): void;

  getChannel(): string;
  setChannel(value: string): void;

  getGroup(): string;
  setGroup(value: string): void;

  getEventsstoretypedata(): Subscribe.EventsStoreTypeMap[keyof Subscribe.EventsStoreTypeMap];
  setEventsstoretypedata(value: Subscribe.EventsStoreTypeMap[keyof Subscribe.EventsStoreTypeMap]): void;

  getEventsstoretypevalue(): number;
  setEventsstoretypevalue(value: number): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Subscribe.AsObject;
  static toObject(includeInstance: boolean, msg: Subscribe): Subscribe.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: Subscribe, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): Subscribe;
  static deserializeBinaryFromReader(message: Subscribe, reader: jspb.BinaryReader): Subscribe;
}

export namespace Subscribe {
  export type AsObject = {
    subscribetypedata: Subscribe.SubscribeTypeMap[keyof Subscribe.SubscribeTypeMap],
    clientid: string,
    channel: string,
    group: string,
    eventsstoretypedata: Subscribe.EventsStoreTypeMap[keyof Subscribe.EventsStoreTypeMap],
    eventsstoretypevalue: number,
  }

  export interface SubscribeTypeMap {
    SUBSCRIBETYPEUNDEFINED: 0;
    EVENTS: 1;
    EVENTSSTORE: 2;
    COMMANDS: 3;
    QUERIES: 4;
  }

  export const SubscribeType: SubscribeTypeMap;

  export interface EventsStoreTypeMap {
    EVENTSSTORETYPEUNDEFINED: 0;
    STARTNEWONLY: 1;
    STARTFROMFIRST: 2;
    STARTFROMLAST: 3;
    STARTATSEQUENCE: 4;
    STARTATTIME: 5;
    STARTATTIMEDELTA: 6;
  }

  export const EventsStoreType: EventsStoreTypeMap;
}

export class Request extends jspb.Message {
  getRequestid(): string;
  setRequestid(value: string): void;

  getRequesttypedata(): Request.RequestTypeMap[keyof Request.RequestTypeMap];
  setRequesttypedata(value: Request.RequestTypeMap[keyof Request.RequestTypeMap]): void;

  getClientid(): string;
  setClientid(value: string): void;

  getChannel(): string;
  setChannel(value: string): void;

  getMetadata(): string;
  setMetadata(value: string): void;

  getBody(): Uint8Array | string;
  getBody_asU8(): Uint8Array;
  getBody_asB64(): string;
  setBody(value: Uint8Array | string): void;

  getReplychannel(): string;
  setReplychannel(value: string): void;

  getTimeout(): number;
  setTimeout(value: number): void;

  getCachekey(): string;
  setCachekey(value: string): void;

  getCachettl(): number;
  setCachettl(value: number): void;

  getSpan(): Uint8Array | string;
  getSpan_asU8(): Uint8Array;
  getSpan_asB64(): string;
  setSpan(value: Uint8Array | string): void;

  getTagsMap(): jspb.Map<string, string>;
  clearTagsMap(): void;
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Request.AsObject;
  static toObject(includeInstance: boolean, msg: Request): Request.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: Request, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): Request;
  static deserializeBinaryFromReader(message: Request, reader: jspb.BinaryReader): Request;
}

export namespace Request {
  export type AsObject = {
    requestid: string,
    requesttypedata: Request.RequestTypeMap[keyof Request.RequestTypeMap],
    clientid: string,
    channel: string,
    metadata: string,
    body: Uint8Array | string,
    replychannel: string,
    timeout: number,
    cachekey: string,
    cachettl: number,
    span: Uint8Array | string,
    tagsMap: Array<[string, string]>,
  }

  export interface RequestTypeMap {
    REQUESTTYPEUNKNOWN: 0;
    COMMAND: 1;
    QUERY: 2;
  }

  export const RequestType: RequestTypeMap;
}

export class Response extends jspb.Message {
  getClientid(): string;
  setClientid(value: string): void;

  getRequestid(): string;
  setRequestid(value: string): void;

  getReplychannel(): string;
  setReplychannel(value: string): void;

  getMetadata(): string;
  setMetadata(value: string): void;

  getBody(): Uint8Array | string;
  getBody_asU8(): Uint8Array;
  getBody_asB64(): string;
  setBody(value: Uint8Array | string): void;

  getCachehit(): boolean;
  setCachehit(value: boolean): void;

  getTimestamp(): number;
  setTimestamp(value: number): void;

  getExecuted(): boolean;
  setExecuted(value: boolean): void;

  getError(): string;
  setError(value: string): void;

  getSpan(): Uint8Array | string;
  getSpan_asU8(): Uint8Array;
  getSpan_asB64(): string;
  setSpan(value: Uint8Array | string): void;

  getTagsMap(): jspb.Map<string, string>;
  clearTagsMap(): void;
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Response.AsObject;
  static toObject(includeInstance: boolean, msg: Response): Response.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: Response, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): Response;
  static deserializeBinaryFromReader(message: Response, reader: jspb.BinaryReader): Response;
}

export namespace Response {
  export type AsObject = {
    clientid: string,
    requestid: string,
    replychannel: string,
    metadata: string,
    body: Uint8Array | string,
    cachehit: boolean,
    timestamp: number,
    executed: boolean,
    error: string,
    span: Uint8Array | string,
    tagsMap: Array<[string, string]>,
  }
}

export class QueueMessage extends jspb.Message {
  getMessageid(): string;
  setMessageid(value: string): void;

  getClientid(): string;
  setClientid(value: string): void;

  getChannel(): string;
  setChannel(value: string): void;

  getMetadata(): string;
  setMetadata(value: string): void;

  getBody(): Uint8Array | string;
  getBody_asU8(): Uint8Array;
  getBody_asB64(): string;
  setBody(value: Uint8Array | string): void;

  getTagsMap(): jspb.Map<string, string>;
  clearTagsMap(): void;
  hasAttributes(): boolean;
  clearAttributes(): void;
  getAttributes(): QueueMessageAttributes | undefined;
  setAttributes(value?: QueueMessageAttributes): void;

  hasPolicy(): boolean;
  clearPolicy(): void;
  getPolicy(): QueueMessagePolicy | undefined;
  setPolicy(value?: QueueMessagePolicy): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): QueueMessage.AsObject;
  static toObject(includeInstance: boolean, msg: QueueMessage): QueueMessage.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: QueueMessage, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): QueueMessage;
  static deserializeBinaryFromReader(message: QueueMessage, reader: jspb.BinaryReader): QueueMessage;
}

export namespace QueueMessage {
  export type AsObject = {
    messageid: string,
    clientid: string,
    channel: string,
    metadata: string,
    body: Uint8Array | string,
    tagsMap: Array<[string, string]>,
    attributes?: QueueMessageAttributes.AsObject,
    policy?: QueueMessagePolicy.AsObject,
  }
}

export class QueueMessagesBatchRequest extends jspb.Message {
  getBatchid(): string;
  setBatchid(value: string): void;

  clearMessagesList(): void;
  getMessagesList(): Array<QueueMessage>;
  setMessagesList(value: Array<QueueMessage>): void;
  addMessages(value?: QueueMessage, index?: number): QueueMessage;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): QueueMessagesBatchRequest.AsObject;
  static toObject(includeInstance: boolean, msg: QueueMessagesBatchRequest): QueueMessagesBatchRequest.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: QueueMessagesBatchRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): QueueMessagesBatchRequest;
  static deserializeBinaryFromReader(message: QueueMessagesBatchRequest, reader: jspb.BinaryReader): QueueMessagesBatchRequest;
}

export namespace QueueMessagesBatchRequest {
  export type AsObject = {
    batchid: string,
    messagesList: Array<QueueMessage.AsObject>,
  }
}

export class QueueMessagesBatchResponse extends jspb.Message {
  getBatchid(): string;
  setBatchid(value: string): void;

  clearResultsList(): void;
  getResultsList(): Array<SendQueueMessageResult>;
  setResultsList(value: Array<SendQueueMessageResult>): void;
  addResults(value?: SendQueueMessageResult, index?: number): SendQueueMessageResult;

  getHaveerrors(): boolean;
  setHaveerrors(value: boolean): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): QueueMessagesBatchResponse.AsObject;
  static toObject(includeInstance: boolean, msg: QueueMessagesBatchResponse): QueueMessagesBatchResponse.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: QueueMessagesBatchResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): QueueMessagesBatchResponse;
  static deserializeBinaryFromReader(message: QueueMessagesBatchResponse, reader: jspb.BinaryReader): QueueMessagesBatchResponse;
}

export namespace QueueMessagesBatchResponse {
  export type AsObject = {
    batchid: string,
    resultsList: Array<SendQueueMessageResult.AsObject>,
    haveerrors: boolean,
  }
}

export class QueueMessageAttributes extends jspb.Message {
  getTimestamp(): number;
  setTimestamp(value: number): void;

  getSequence(): number;
  setSequence(value: number): void;

  getMd5ofbody(): string;
  setMd5ofbody(value: string): void;

  getReceivecount(): number;
  setReceivecount(value: number): void;

  getRerouted(): boolean;
  setRerouted(value: boolean): void;

  getReroutedfromqueue(): string;
  setReroutedfromqueue(value: string): void;

  getExpirationat(): number;
  setExpirationat(value: number): void;

  getDelayedto(): number;
  setDelayedto(value: number): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): QueueMessageAttributes.AsObject;
  static toObject(includeInstance: boolean, msg: QueueMessageAttributes): QueueMessageAttributes.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: QueueMessageAttributes, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): QueueMessageAttributes;
  static deserializeBinaryFromReader(message: QueueMessageAttributes, reader: jspb.BinaryReader): QueueMessageAttributes;
}

export namespace QueueMessageAttributes {
  export type AsObject = {
    timestamp: number,
    sequence: number,
    md5ofbody: string,
    receivecount: number,
    rerouted: boolean,
    reroutedfromqueue: string,
    expirationat: number,
    delayedto: number,
  }
}

export class QueueMessagePolicy extends jspb.Message {
  getExpirationseconds(): number;
  setExpirationseconds(value: number): void;

  getDelayseconds(): number;
  setDelayseconds(value: number): void;

  getMaxreceivecount(): number;
  setMaxreceivecount(value: number): void;

  getMaxreceivequeue(): string;
  setMaxreceivequeue(value: string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): QueueMessagePolicy.AsObject;
  static toObject(includeInstance: boolean, msg: QueueMessagePolicy): QueueMessagePolicy.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: QueueMessagePolicy, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): QueueMessagePolicy;
  static deserializeBinaryFromReader(message: QueueMessagePolicy, reader: jspb.BinaryReader): QueueMessagePolicy;
}

export namespace QueueMessagePolicy {
  export type AsObject = {
    expirationseconds: number,
    delayseconds: number,
    maxreceivecount: number,
    maxreceivequeue: string,
  }
}

export class SendQueueMessageResult extends jspb.Message {
  getMessageid(): string;
  setMessageid(value: string): void;

  getSentat(): number;
  setSentat(value: number): void;

  getExpirationat(): number;
  setExpirationat(value: number): void;

  getDelayedto(): number;
  setDelayedto(value: number): void;

  getIserror(): boolean;
  setIserror(value: boolean): void;

  getError(): string;
  setError(value: string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): SendQueueMessageResult.AsObject;
  static toObject(includeInstance: boolean, msg: SendQueueMessageResult): SendQueueMessageResult.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: SendQueueMessageResult, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): SendQueueMessageResult;
  static deserializeBinaryFromReader(message: SendQueueMessageResult, reader: jspb.BinaryReader): SendQueueMessageResult;
}

export namespace SendQueueMessageResult {
  export type AsObject = {
    messageid: string,
    sentat: number,
    expirationat: number,
    delayedto: number,
    iserror: boolean,
    error: string,
  }
}

export class ReceiveQueueMessagesRequest extends jspb.Message {
  getRequestid(): string;
  setRequestid(value: string): void;

  getClientid(): string;
  setClientid(value: string): void;

  getChannel(): string;
  setChannel(value: string): void;

  getMaxnumberofmessages(): number;
  setMaxnumberofmessages(value: number): void;

  getWaittimeseconds(): number;
  setWaittimeseconds(value: number): void;

  getIspeak(): boolean;
  setIspeak(value: boolean): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): ReceiveQueueMessagesRequest.AsObject;
  static toObject(includeInstance: boolean, msg: ReceiveQueueMessagesRequest): ReceiveQueueMessagesRequest.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: ReceiveQueueMessagesRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): ReceiveQueueMessagesRequest;
  static deserializeBinaryFromReader(message: ReceiveQueueMessagesRequest, reader: jspb.BinaryReader): ReceiveQueueMessagesRequest;
}

export namespace ReceiveQueueMessagesRequest {
  export type AsObject = {
    requestid: string,
    clientid: string,
    channel: string,
    maxnumberofmessages: number,
    waittimeseconds: number,
    ispeak: boolean,
  }
}

export class ReceiveQueueMessagesResponse extends jspb.Message {
  getRequestid(): string;
  setRequestid(value: string): void;

  clearMessagesList(): void;
  getMessagesList(): Array<QueueMessage>;
  setMessagesList(value: Array<QueueMessage>): void;
  addMessages(value?: QueueMessage, index?: number): QueueMessage;

  getMessagesreceived(): number;
  setMessagesreceived(value: number): void;

  getMessagesexpired(): number;
  setMessagesexpired(value: number): void;

  getIspeak(): boolean;
  setIspeak(value: boolean): void;

  getIserror(): boolean;
  setIserror(value: boolean): void;

  getError(): string;
  setError(value: string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): ReceiveQueueMessagesResponse.AsObject;
  static toObject(includeInstance: boolean, msg: ReceiveQueueMessagesResponse): ReceiveQueueMessagesResponse.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: ReceiveQueueMessagesResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): ReceiveQueueMessagesResponse;
  static deserializeBinaryFromReader(message: ReceiveQueueMessagesResponse, reader: jspb.BinaryReader): ReceiveQueueMessagesResponse;
}

export namespace ReceiveQueueMessagesResponse {
  export type AsObject = {
    requestid: string,
    messagesList: Array<QueueMessage.AsObject>,
    messagesreceived: number,
    messagesexpired: number,
    ispeak: boolean,
    iserror: boolean,
    error: string,
  }
}

export class AckAllQueueMessagesRequest extends jspb.Message {
  getRequestid(): string;
  setRequestid(value: string): void;

  getClientid(): string;
  setClientid(value: string): void;

  getChannel(): string;
  setChannel(value: string): void;

  getWaittimeseconds(): number;
  setWaittimeseconds(value: number): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): AckAllQueueMessagesRequest.AsObject;
  static toObject(includeInstance: boolean, msg: AckAllQueueMessagesRequest): AckAllQueueMessagesRequest.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: AckAllQueueMessagesRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): AckAllQueueMessagesRequest;
  static deserializeBinaryFromReader(message: AckAllQueueMessagesRequest, reader: jspb.BinaryReader): AckAllQueueMessagesRequest;
}

export namespace AckAllQueueMessagesRequest {
  export type AsObject = {
    requestid: string,
    clientid: string,
    channel: string,
    waittimeseconds: number,
  }
}

export class AckAllQueueMessagesResponse extends jspb.Message {
  getRequestid(): string;
  setRequestid(value: string): void;

  getAffectedmessages(): number;
  setAffectedmessages(value: number): void;

  getIserror(): boolean;
  setIserror(value: boolean): void;

  getError(): string;
  setError(value: string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): AckAllQueueMessagesResponse.AsObject;
  static toObject(includeInstance: boolean, msg: AckAllQueueMessagesResponse): AckAllQueueMessagesResponse.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: AckAllQueueMessagesResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): AckAllQueueMessagesResponse;
  static deserializeBinaryFromReader(message: AckAllQueueMessagesResponse, reader: jspb.BinaryReader): AckAllQueueMessagesResponse;
}

export namespace AckAllQueueMessagesResponse {
  export type AsObject = {
    requestid: string,
    affectedmessages: number,
    iserror: boolean,
    error: string,
  }
}

export class StreamQueueMessagesRequest extends jspb.Message {
  getRequestid(): string;
  setRequestid(value: string): void;

  getClientid(): string;
  setClientid(value: string): void;

  getStreamrequesttypedata(): StreamRequestTypeMap[keyof StreamRequestTypeMap];
  setStreamrequesttypedata(value: StreamRequestTypeMap[keyof StreamRequestTypeMap]): void;

  getChannel(): string;
  setChannel(value: string): void;

  getVisibilityseconds(): number;
  setVisibilityseconds(value: number): void;

  getWaittimeseconds(): number;
  setWaittimeseconds(value: number): void;

  getRefsequence(): number;
  setRefsequence(value: number): void;

  hasModifiedmessage(): boolean;
  clearModifiedmessage(): void;
  getModifiedmessage(): QueueMessage | undefined;
  setModifiedmessage(value?: QueueMessage): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): StreamQueueMessagesRequest.AsObject;
  static toObject(includeInstance: boolean, msg: StreamQueueMessagesRequest): StreamQueueMessagesRequest.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: StreamQueueMessagesRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): StreamQueueMessagesRequest;
  static deserializeBinaryFromReader(message: StreamQueueMessagesRequest, reader: jspb.BinaryReader): StreamQueueMessagesRequest;
}

export namespace StreamQueueMessagesRequest {
  export type AsObject = {
    requestid: string,
    clientid: string,
    streamrequesttypedata: StreamRequestTypeMap[keyof StreamRequestTypeMap],
    channel: string,
    visibilityseconds: number,
    waittimeseconds: number,
    refsequence: number,
    modifiedmessage?: QueueMessage.AsObject,
  }
}

export class StreamQueueMessagesResponse extends jspb.Message {
  getRequestid(): string;
  setRequestid(value: string): void;

  getStreamrequesttypedata(): StreamRequestTypeMap[keyof StreamRequestTypeMap];
  setStreamrequesttypedata(value: StreamRequestTypeMap[keyof StreamRequestTypeMap]): void;

  hasMessage(): boolean;
  clearMessage(): void;
  getMessage(): QueueMessage | undefined;
  setMessage(value?: QueueMessage): void;

  getIserror(): boolean;
  setIserror(value: boolean): void;

  getError(): string;
  setError(value: string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): StreamQueueMessagesResponse.AsObject;
  static toObject(includeInstance: boolean, msg: StreamQueueMessagesResponse): StreamQueueMessagesResponse.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: StreamQueueMessagesResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): StreamQueueMessagesResponse;
  static deserializeBinaryFromReader(message: StreamQueueMessagesResponse, reader: jspb.BinaryReader): StreamQueueMessagesResponse;
}

export namespace StreamQueueMessagesResponse {
  export type AsObject = {
    requestid: string,
    streamrequesttypedata: StreamRequestTypeMap[keyof StreamRequestTypeMap],
    message?: QueueMessage.AsObject,
    iserror: boolean,
    error: string,
  }
}

export interface StreamRequestTypeMap {
  STREAMREQUESTTYPEUNKNOWN: 0;
  RECEIVEMESSAGE: 1;
  ACKMESSAGE: 2;
  REJECTMESSAGE: 3;
  MODIFYVISIBILITY: 4;
  RESENDMESSAGE: 5;
  SENDMODIFIEDMESSAGE: 6;
}

export const StreamRequestType: StreamRequestTypeMap;

