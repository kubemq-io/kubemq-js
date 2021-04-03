// GENERATED CODE -- DO NOT EDIT!

// package: kubemq
// file: src/protos/grpc/kubemq.proto

import * as src_protos_grpc_kubemq_pb from "./kubemq_pb";
import * as grpc from '@grpc/grpc-js';

interface IkubemqService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
  sendEvent: grpc.MethodDefinition<src_protos_grpc_kubemq_pb.Event, src_protos_grpc_kubemq_pb.Result>;
  sendEventsStream: grpc.MethodDefinition<src_protos_grpc_kubemq_pb.Event, src_protos_grpc_kubemq_pb.Result>;
  subscribeToEvents: grpc.MethodDefinition<src_protos_grpc_kubemq_pb.Subscribe, src_protos_grpc_kubemq_pb.EventReceive>;
  subscribeToRequests: grpc.MethodDefinition<src_protos_grpc_kubemq_pb.Subscribe, src_protos_grpc_kubemq_pb.Request>;
  sendRequest: grpc.MethodDefinition<src_protos_grpc_kubemq_pb.Request, src_protos_grpc_kubemq_pb.Response>;
  sendResponse: grpc.MethodDefinition<src_protos_grpc_kubemq_pb.Response, src_protos_grpc_kubemq_pb.Empty>;
  sendQueueMessage: grpc.MethodDefinition<src_protos_grpc_kubemq_pb.QueueMessage, src_protos_grpc_kubemq_pb.SendQueueMessageResult>;
  sendQueueMessagesBatch: grpc.MethodDefinition<src_protos_grpc_kubemq_pb.QueueMessagesBatchRequest, src_protos_grpc_kubemq_pb.QueueMessagesBatchResponse>;
  receiveQueueMessages: grpc.MethodDefinition<src_protos_grpc_kubemq_pb.ReceiveQueueMessagesRequest, src_protos_grpc_kubemq_pb.ReceiveQueueMessagesResponse>;
  streamQueueMessage: grpc.MethodDefinition<src_protos_grpc_kubemq_pb.StreamQueueMessagesRequest, src_protos_grpc_kubemq_pb.StreamQueueMessagesResponse>;
  ackAllQueueMessages: grpc.MethodDefinition<src_protos_grpc_kubemq_pb.AckAllQueueMessagesRequest, src_protos_grpc_kubemq_pb.AckAllQueueMessagesResponse>;
  ping: grpc.MethodDefinition<src_protos_grpc_kubemq_pb.Empty, src_protos_grpc_kubemq_pb.PingResult>;
}

export const kubemqService: IkubemqService;

export class kubemqClient extends grpc.Client {
  constructor(address: string, credentials: grpc.ChannelCredentials, options?: object);
  sendEvent(argument: src_protos_grpc_kubemq_pb.Event, callback: grpc.requestCallback<src_protos_grpc_kubemq_pb.Result>): grpc.ClientUnaryCall;
  sendEvent(argument: src_protos_grpc_kubemq_pb.Event, metadataOrOptions: grpc.Metadata | grpc.CallOptions | null, callback: grpc.requestCallback<src_protos_grpc_kubemq_pb.Result>): grpc.ClientUnaryCall;
  sendEvent(argument: src_protos_grpc_kubemq_pb.Event, metadata: grpc.Metadata | null, options: grpc.CallOptions | null, callback: grpc.requestCallback<src_protos_grpc_kubemq_pb.Result>): grpc.ClientUnaryCall;
  sendEventsStream(metadataOrOptions?: grpc.Metadata | grpc.CallOptions | null): grpc.ClientDuplexStream<src_protos_grpc_kubemq_pb.Event, src_protos_grpc_kubemq_pb.Result>;
  sendEventsStream(metadata?: grpc.Metadata | null, options?: grpc.CallOptions | null): grpc.ClientDuplexStream<src_protos_grpc_kubemq_pb.Event, src_protos_grpc_kubemq_pb.Result>;
  subscribeToEvents(argument: src_protos_grpc_kubemq_pb.Subscribe, metadataOrOptions?: grpc.Metadata | grpc.CallOptions | null): grpc.ClientReadableStream<src_protos_grpc_kubemq_pb.EventReceive>;
  subscribeToEvents(argument: src_protos_grpc_kubemq_pb.Subscribe, metadata?: grpc.Metadata | null, options?: grpc.CallOptions | null): grpc.ClientReadableStream<src_protos_grpc_kubemq_pb.EventReceive>;
  subscribeToRequests(argument: src_protos_grpc_kubemq_pb.Subscribe, metadataOrOptions?: grpc.Metadata | grpc.CallOptions | null): grpc.ClientReadableStream<src_protos_grpc_kubemq_pb.Request>;
  subscribeToRequests(argument: src_protos_grpc_kubemq_pb.Subscribe, metadata?: grpc.Metadata | null, options?: grpc.CallOptions | null): grpc.ClientReadableStream<src_protos_grpc_kubemq_pb.Request>;
  sendRequest(argument: src_protos_grpc_kubemq_pb.Request, callback: grpc.requestCallback<src_protos_grpc_kubemq_pb.Response>): grpc.ClientUnaryCall;
  sendRequest(argument: src_protos_grpc_kubemq_pb.Request, metadataOrOptions: grpc.Metadata | grpc.CallOptions | null, callback: grpc.requestCallback<src_protos_grpc_kubemq_pb.Response>): grpc.ClientUnaryCall;
  sendRequest(argument: src_protos_grpc_kubemq_pb.Request, metadata: grpc.Metadata | null, options: grpc.CallOptions | null, callback: grpc.requestCallback<src_protos_grpc_kubemq_pb.Response>): grpc.ClientUnaryCall;
  sendResponse(argument: src_protos_grpc_kubemq_pb.Response, callback: grpc.requestCallback<src_protos_grpc_kubemq_pb.Empty>): grpc.ClientUnaryCall;
  sendResponse(argument: src_protos_grpc_kubemq_pb.Response, metadataOrOptions: grpc.Metadata | grpc.CallOptions | null, callback: grpc.requestCallback<src_protos_grpc_kubemq_pb.Empty>): grpc.ClientUnaryCall;
  sendResponse(argument: src_protos_grpc_kubemq_pb.Response, metadata: grpc.Metadata | null, options: grpc.CallOptions | null, callback: grpc.requestCallback<src_protos_grpc_kubemq_pb.Empty>): grpc.ClientUnaryCall;
  sendQueueMessage(argument: src_protos_grpc_kubemq_pb.QueueMessage, callback: grpc.requestCallback<src_protos_grpc_kubemq_pb.SendQueueMessageResult>): grpc.ClientUnaryCall;
  sendQueueMessage(argument: src_protos_grpc_kubemq_pb.QueueMessage, metadataOrOptions: grpc.Metadata | grpc.CallOptions | null, callback: grpc.requestCallback<src_protos_grpc_kubemq_pb.SendQueueMessageResult>): grpc.ClientUnaryCall;
  sendQueueMessage(argument: src_protos_grpc_kubemq_pb.QueueMessage, metadata: grpc.Metadata | null, options: grpc.CallOptions | null, callback: grpc.requestCallback<src_protos_grpc_kubemq_pb.SendQueueMessageResult>): grpc.ClientUnaryCall;
  sendQueueMessagesBatch(argument: src_protos_grpc_kubemq_pb.QueueMessagesBatchRequest, callback: grpc.requestCallback<src_protos_grpc_kubemq_pb.QueueMessagesBatchResponse>): grpc.ClientUnaryCall;
  sendQueueMessagesBatch(argument: src_protos_grpc_kubemq_pb.QueueMessagesBatchRequest, metadataOrOptions: grpc.Metadata | grpc.CallOptions | null, callback: grpc.requestCallback<src_protos_grpc_kubemq_pb.QueueMessagesBatchResponse>): grpc.ClientUnaryCall;
  sendQueueMessagesBatch(argument: src_protos_grpc_kubemq_pb.QueueMessagesBatchRequest, metadata: grpc.Metadata | null, options: grpc.CallOptions | null, callback: grpc.requestCallback<src_protos_grpc_kubemq_pb.QueueMessagesBatchResponse>): grpc.ClientUnaryCall;
  receiveQueueMessages(argument: src_protos_grpc_kubemq_pb.ReceiveQueueMessagesRequest, callback: grpc.requestCallback<src_protos_grpc_kubemq_pb.ReceiveQueueMessagesResponse>): grpc.ClientUnaryCall;
  receiveQueueMessages(argument: src_protos_grpc_kubemq_pb.ReceiveQueueMessagesRequest, metadataOrOptions: grpc.Metadata | grpc.CallOptions | null, callback: grpc.requestCallback<src_protos_grpc_kubemq_pb.ReceiveQueueMessagesResponse>): grpc.ClientUnaryCall;
  receiveQueueMessages(argument: src_protos_grpc_kubemq_pb.ReceiveQueueMessagesRequest, metadata: grpc.Metadata | null, options: grpc.CallOptions | null, callback: grpc.requestCallback<src_protos_grpc_kubemq_pb.ReceiveQueueMessagesResponse>): grpc.ClientUnaryCall;
  streamQueueMessage(metadataOrOptions?: grpc.Metadata | grpc.CallOptions | null): grpc.ClientDuplexStream<src_protos_grpc_kubemq_pb.StreamQueueMessagesRequest, src_protos_grpc_kubemq_pb.StreamQueueMessagesResponse>;
  streamQueueMessage(metadata?: grpc.Metadata | null, options?: grpc.CallOptions | null): grpc.ClientDuplexStream<src_protos_grpc_kubemq_pb.StreamQueueMessagesRequest, src_protos_grpc_kubemq_pb.StreamQueueMessagesResponse>;
  ackAllQueueMessages(argument: src_protos_grpc_kubemq_pb.AckAllQueueMessagesRequest, callback: grpc.requestCallback<src_protos_grpc_kubemq_pb.AckAllQueueMessagesResponse>): grpc.ClientUnaryCall;
  ackAllQueueMessages(argument: src_protos_grpc_kubemq_pb.AckAllQueueMessagesRequest, metadataOrOptions: grpc.Metadata | grpc.CallOptions | null, callback: grpc.requestCallback<src_protos_grpc_kubemq_pb.AckAllQueueMessagesResponse>): grpc.ClientUnaryCall;
  ackAllQueueMessages(argument: src_protos_grpc_kubemq_pb.AckAllQueueMessagesRequest, metadata: grpc.Metadata | null, options: grpc.CallOptions | null, callback: grpc.requestCallback<src_protos_grpc_kubemq_pb.AckAllQueueMessagesResponse>): grpc.ClientUnaryCall;
  ping(argument: src_protos_grpc_kubemq_pb.Empty, callback: grpc.requestCallback<src_protos_grpc_kubemq_pb.PingResult>): grpc.ClientUnaryCall;
  ping(argument: src_protos_grpc_kubemq_pb.Empty, metadataOrOptions: grpc.Metadata | grpc.CallOptions | null, callback: grpc.requestCallback<src_protos_grpc_kubemq_pb.PingResult>): grpc.ClientUnaryCall;
  ping(argument: src_protos_grpc_kubemq_pb.Empty, metadata: grpc.Metadata | null, options: grpc.CallOptions | null, callback: grpc.requestCallback<src_protos_grpc_kubemq_pb.PingResult>): grpc.ClientUnaryCall;
}
