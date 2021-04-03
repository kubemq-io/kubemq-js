export namespace kubemqService {
    namespace sendEvent {
        export const path: string;
        export const requestStream: boolean;
        export const responseStream: boolean;
        export const requestType: typeof src_protos_grpc_kubemq_pb.Event;
        export const responseType: typeof src_protos_grpc_kubemq_pb.Result;
        export { serialize_kubemq_Event as requestSerialize };
        export { deserialize_kubemq_Event as requestDeserialize };
        export { serialize_kubemq_Result as responseSerialize };
        export { deserialize_kubemq_Result as responseDeserialize };
    }
    namespace sendEventsStream {
        const path_1: string;
        export { path_1 as path };
        const requestStream_1: boolean;
        export { requestStream_1 as requestStream };
        const responseStream_1: boolean;
        export { responseStream_1 as responseStream };
        const requestType_1: typeof src_protos_grpc_kubemq_pb.Event;
        export { requestType_1 as requestType };
        const responseType_1: typeof src_protos_grpc_kubemq_pb.Result;
        export { responseType_1 as responseType };
        export { serialize_kubemq_Event as requestSerialize };
        export { deserialize_kubemq_Event as requestDeserialize };
        export { serialize_kubemq_Result as responseSerialize };
        export { deserialize_kubemq_Result as responseDeserialize };
    }
    namespace subscribeToEvents {
        const path_2: string;
        export { path_2 as path };
        const requestStream_2: boolean;
        export { requestStream_2 as requestStream };
        const responseStream_2: boolean;
        export { responseStream_2 as responseStream };
        const requestType_2: typeof src_protos_grpc_kubemq_pb.Subscribe;
        export { requestType_2 as requestType };
        const responseType_2: typeof src_protos_grpc_kubemq_pb.EventReceive;
        export { responseType_2 as responseType };
        export { serialize_kubemq_Subscribe as requestSerialize };
        export { deserialize_kubemq_Subscribe as requestDeserialize };
        export { serialize_kubemq_EventReceive as responseSerialize };
        export { deserialize_kubemq_EventReceive as responseDeserialize };
    }
    namespace subscribeToRequests {
        const path_3: string;
        export { path_3 as path };
        const requestStream_3: boolean;
        export { requestStream_3 as requestStream };
        const responseStream_3: boolean;
        export { responseStream_3 as responseStream };
        const requestType_3: typeof src_protos_grpc_kubemq_pb.Subscribe;
        export { requestType_3 as requestType };
        const responseType_3: typeof src_protos_grpc_kubemq_pb.Request;
        export { responseType_3 as responseType };
        export { serialize_kubemq_Subscribe as requestSerialize };
        export { deserialize_kubemq_Subscribe as requestDeserialize };
        export { serialize_kubemq_Request as responseSerialize };
        export { deserialize_kubemq_Request as responseDeserialize };
    }
    namespace sendRequest {
        const path_4: string;
        export { path_4 as path };
        const requestStream_4: boolean;
        export { requestStream_4 as requestStream };
        const responseStream_4: boolean;
        export { responseStream_4 as responseStream };
        const requestType_4: typeof src_protos_grpc_kubemq_pb.Request;
        export { requestType_4 as requestType };
        const responseType_4: typeof src_protos_grpc_kubemq_pb.Response;
        export { responseType_4 as responseType };
        export { serialize_kubemq_Request as requestSerialize };
        export { deserialize_kubemq_Request as requestDeserialize };
        export { serialize_kubemq_Response as responseSerialize };
        export { deserialize_kubemq_Response as responseDeserialize };
    }
    namespace sendResponse {
        const path_5: string;
        export { path_5 as path };
        const requestStream_5: boolean;
        export { requestStream_5 as requestStream };
        const responseStream_5: boolean;
        export { responseStream_5 as responseStream };
        const requestType_5: typeof src_protos_grpc_kubemq_pb.Response;
        export { requestType_5 as requestType };
        const responseType_5: typeof src_protos_grpc_kubemq_pb.Empty;
        export { responseType_5 as responseType };
        export { serialize_kubemq_Response as requestSerialize };
        export { deserialize_kubemq_Response as requestDeserialize };
        export { serialize_kubemq_Empty as responseSerialize };
        export { deserialize_kubemq_Empty as responseDeserialize };
    }
    namespace sendQueueMessage {
        const path_6: string;
        export { path_6 as path };
        const requestStream_6: boolean;
        export { requestStream_6 as requestStream };
        const responseStream_6: boolean;
        export { responseStream_6 as responseStream };
        const requestType_6: typeof src_protos_grpc_kubemq_pb.QueueMessage;
        export { requestType_6 as requestType };
        const responseType_6: typeof src_protos_grpc_kubemq_pb.SendQueueMessageResult;
        export { responseType_6 as responseType };
        export { serialize_kubemq_QueueMessage as requestSerialize };
        export { deserialize_kubemq_QueueMessage as requestDeserialize };
        export { serialize_kubemq_SendQueueMessageResult as responseSerialize };
        export { deserialize_kubemq_SendQueueMessageResult as responseDeserialize };
    }
    namespace sendQueueMessagesBatch {
        const path_7: string;
        export { path_7 as path };
        const requestStream_7: boolean;
        export { requestStream_7 as requestStream };
        const responseStream_7: boolean;
        export { responseStream_7 as responseStream };
        const requestType_7: typeof src_protos_grpc_kubemq_pb.QueueMessagesBatchRequest;
        export { requestType_7 as requestType };
        const responseType_7: typeof src_protos_grpc_kubemq_pb.QueueMessagesBatchResponse;
        export { responseType_7 as responseType };
        export { serialize_kubemq_QueueMessagesBatchRequest as requestSerialize };
        export { deserialize_kubemq_QueueMessagesBatchRequest as requestDeserialize };
        export { serialize_kubemq_QueueMessagesBatchResponse as responseSerialize };
        export { deserialize_kubemq_QueueMessagesBatchResponse as responseDeserialize };
    }
    namespace receiveQueueMessages {
        const path_8: string;
        export { path_8 as path };
        const requestStream_8: boolean;
        export { requestStream_8 as requestStream };
        const responseStream_8: boolean;
        export { responseStream_8 as responseStream };
        const requestType_8: typeof src_protos_grpc_kubemq_pb.ReceiveQueueMessagesRequest;
        export { requestType_8 as requestType };
        const responseType_8: typeof src_protos_grpc_kubemq_pb.ReceiveQueueMessagesResponse;
        export { responseType_8 as responseType };
        export { serialize_kubemq_ReceiveQueueMessagesRequest as requestSerialize };
        export { deserialize_kubemq_ReceiveQueueMessagesRequest as requestDeserialize };
        export { serialize_kubemq_ReceiveQueueMessagesResponse as responseSerialize };
        export { deserialize_kubemq_ReceiveQueueMessagesResponse as responseDeserialize };
    }
    namespace streamQueueMessage {
        const path_9: string;
        export { path_9 as path };
        const requestStream_9: boolean;
        export { requestStream_9 as requestStream };
        const responseStream_9: boolean;
        export { responseStream_9 as responseStream };
        const requestType_9: typeof src_protos_grpc_kubemq_pb.StreamQueueMessagesRequest;
        export { requestType_9 as requestType };
        const responseType_9: typeof src_protos_grpc_kubemq_pb.StreamQueueMessagesResponse;
        export { responseType_9 as responseType };
        export { serialize_kubemq_StreamQueueMessagesRequest as requestSerialize };
        export { deserialize_kubemq_StreamQueueMessagesRequest as requestDeserialize };
        export { serialize_kubemq_StreamQueueMessagesResponse as responseSerialize };
        export { deserialize_kubemq_StreamQueueMessagesResponse as responseDeserialize };
    }
    namespace ackAllQueueMessages {
        const path_10: string;
        export { path_10 as path };
        const requestStream_10: boolean;
        export { requestStream_10 as requestStream };
        const responseStream_10: boolean;
        export { responseStream_10 as responseStream };
        const requestType_10: typeof src_protos_grpc_kubemq_pb.AckAllQueueMessagesRequest;
        export { requestType_10 as requestType };
        const responseType_10: typeof src_protos_grpc_kubemq_pb.AckAllQueueMessagesResponse;
        export { responseType_10 as responseType };
        export { serialize_kubemq_AckAllQueueMessagesRequest as requestSerialize };
        export { deserialize_kubemq_AckAllQueueMessagesRequest as requestDeserialize };
        export { serialize_kubemq_AckAllQueueMessagesResponse as responseSerialize };
        export { deserialize_kubemq_AckAllQueueMessagesResponse as responseDeserialize };
    }
    namespace ping {
        const path_11: string;
        export { path_11 as path };
        const requestStream_11: boolean;
        export { requestStream_11 as requestStream };
        const responseStream_11: boolean;
        export { responseStream_11 as responseStream };
        const requestType_11: typeof src_protos_grpc_kubemq_pb.Empty;
        export { requestType_11 as requestType };
        const responseType_11: typeof src_protos_grpc_kubemq_pb.PingResult;
        export { responseType_11 as responseType };
        export { serialize_kubemq_Empty as requestSerialize };
        export { deserialize_kubemq_Empty as requestDeserialize };
        export { serialize_kubemq_PingResult as responseSerialize };
        export { deserialize_kubemq_PingResult as responseDeserialize };
    }
}
export var kubemqClient: import("@grpc/grpc-js/build/src/make-client").ServiceClientConstructor;
import src_protos_grpc_kubemq_pb = require("./kubemq_pb.js");
declare function serialize_kubemq_Event(arg: any): Buffer;
declare function deserialize_kubemq_Event(buffer_arg: any): src_protos_grpc_kubemq_pb.Event;
declare function serialize_kubemq_Result(arg: any): Buffer;
declare function deserialize_kubemq_Result(buffer_arg: any): src_protos_grpc_kubemq_pb.Result;
declare function serialize_kubemq_Subscribe(arg: any): Buffer;
declare function deserialize_kubemq_Subscribe(buffer_arg: any): src_protos_grpc_kubemq_pb.Subscribe;
declare function serialize_kubemq_EventReceive(arg: any): Buffer;
declare function deserialize_kubemq_EventReceive(buffer_arg: any): src_protos_grpc_kubemq_pb.EventReceive;
declare function serialize_kubemq_Request(arg: any): Buffer;
declare function deserialize_kubemq_Request(buffer_arg: any): src_protos_grpc_kubemq_pb.Request;
declare function serialize_kubemq_Response(arg: any): Buffer;
declare function deserialize_kubemq_Response(buffer_arg: any): src_protos_grpc_kubemq_pb.Response;
declare function serialize_kubemq_Empty(arg: any): Buffer;
declare function deserialize_kubemq_Empty(buffer_arg: any): src_protos_grpc_kubemq_pb.Empty;
declare function serialize_kubemq_QueueMessage(arg: any): Buffer;
declare function deserialize_kubemq_QueueMessage(buffer_arg: any): src_protos_grpc_kubemq_pb.QueueMessage;
declare function serialize_kubemq_SendQueueMessageResult(arg: any): Buffer;
declare function deserialize_kubemq_SendQueueMessageResult(buffer_arg: any): src_protos_grpc_kubemq_pb.SendQueueMessageResult;
declare function serialize_kubemq_QueueMessagesBatchRequest(arg: any): Buffer;
declare function deserialize_kubemq_QueueMessagesBatchRequest(buffer_arg: any): src_protos_grpc_kubemq_pb.QueueMessagesBatchRequest;
declare function serialize_kubemq_QueueMessagesBatchResponse(arg: any): Buffer;
declare function deserialize_kubemq_QueueMessagesBatchResponse(buffer_arg: any): src_protos_grpc_kubemq_pb.QueueMessagesBatchResponse;
declare function serialize_kubemq_ReceiveQueueMessagesRequest(arg: any): Buffer;
declare function deserialize_kubemq_ReceiveQueueMessagesRequest(buffer_arg: any): src_protos_grpc_kubemq_pb.ReceiveQueueMessagesRequest;
declare function serialize_kubemq_ReceiveQueueMessagesResponse(arg: any): Buffer;
declare function deserialize_kubemq_ReceiveQueueMessagesResponse(buffer_arg: any): src_protos_grpc_kubemq_pb.ReceiveQueueMessagesResponse;
declare function serialize_kubemq_StreamQueueMessagesRequest(arg: any): Buffer;
declare function deserialize_kubemq_StreamQueueMessagesRequest(buffer_arg: any): src_protos_grpc_kubemq_pb.StreamQueueMessagesRequest;
declare function serialize_kubemq_StreamQueueMessagesResponse(arg: any): Buffer;
declare function deserialize_kubemq_StreamQueueMessagesResponse(buffer_arg: any): src_protos_grpc_kubemq_pb.StreamQueueMessagesResponse;
declare function serialize_kubemq_AckAllQueueMessagesRequest(arg: any): Buffer;
declare function deserialize_kubemq_AckAllQueueMessagesRequest(buffer_arg: any): src_protos_grpc_kubemq_pb.AckAllQueueMessagesRequest;
declare function serialize_kubemq_AckAllQueueMessagesResponse(arg: any): Buffer;
declare function deserialize_kubemq_AckAllQueueMessagesResponse(buffer_arg: any): src_protos_grpc_kubemq_pb.AckAllQueueMessagesResponse;
declare function serialize_kubemq_PingResult(arg: any): Buffer;
declare function deserialize_kubemq_PingResult(buffer_arg: any): src_protos_grpc_kubemq_pb.PingResult;
export {};
//# sourceMappingURL=kubemq_grpc_pb.d.ts.map