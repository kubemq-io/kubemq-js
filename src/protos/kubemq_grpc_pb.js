// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('@grpc/grpc-js');
var src_protos_grpc_kubemq_pb = require('./kubemq_pb.d.ts');

function serialize_kubemq_AckAllQueueMessagesRequest(arg) {
  if (!(arg instanceof src_protos_grpc_kubemq_pb.AckAllQueueMessagesRequest)) {
    throw new Error(
      'Expected argument of type kubemq.AckAllQueueMessagesRequest',
    );
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_kubemq_AckAllQueueMessagesRequest(buffer_arg) {
  return src_protos_grpc_kubemq_pb.AckAllQueueMessagesRequest.deserializeBinary(
    new Uint8Array(buffer_arg),
  );
}

function serialize_kubemq_AckAllQueueMessagesResponse(arg) {
  if (!(arg instanceof src_protos_grpc_kubemq_pb.AckAllQueueMessagesResponse)) {
    throw new Error(
      'Expected argument of type kubemq.AckAllQueueMessagesResponse',
    );
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_kubemq_AckAllQueueMessagesResponse(buffer_arg) {
  return src_protos_grpc_kubemq_pb.AckAllQueueMessagesResponse.deserializeBinary(
    new Uint8Array(buffer_arg),
  );
}

function serialize_kubemq_Empty(arg) {
  if (!(arg instanceof src_protos_grpc_kubemq_pb.Empty)) {
    throw new Error('Expected argument of type kubemq.Empty');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_kubemq_Empty(buffer_arg) {
  return src_protos_grpc_kubemq_pb.Empty.deserializeBinary(
    new Uint8Array(buffer_arg),
  );
}

function serialize_kubemq_Event(arg) {
  if (!(arg instanceof src_protos_grpc_kubemq_pb.Event)) {
    throw new Error('Expected argument of type kubemq.Event');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_kubemq_Event(buffer_arg) {
  return src_protos_grpc_kubemq_pb.Event.deserializeBinary(
    new Uint8Array(buffer_arg),
  );
}

function serialize_kubemq_EventReceive(arg) {
  if (!(arg instanceof src_protos_grpc_kubemq_pb.EventReceive)) {
    throw new Error('Expected argument of type kubemq.EventReceive');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_kubemq_EventReceive(buffer_arg) {
  return src_protos_grpc_kubemq_pb.EventReceive.deserializeBinary(
    new Uint8Array(buffer_arg),
  );
}

function serialize_kubemq_PingResult(arg) {
  if (!(arg instanceof src_protos_grpc_kubemq_pb.PingResult)) {
    throw new Error('Expected argument of type kubemq.PingResult');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_kubemq_PingResult(buffer_arg) {
  return src_protos_grpc_kubemq_pb.PingResult.deserializeBinary(
    new Uint8Array(buffer_arg),
  );
}

function serialize_kubemq_QueueMessage(arg) {
  if (!(arg instanceof src_protos_grpc_kubemq_pb.QueueMessage)) {
    throw new Error('Expected argument of type kubemq.QueueMessage');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_kubemq_QueueMessage(buffer_arg) {
  return src_protos_grpc_kubemq_pb.QueueMessage.deserializeBinary(
    new Uint8Array(buffer_arg),
  );
}

function serialize_kubemq_QueueMessagesBatchRequest(arg) {
  if (!(arg instanceof src_protos_grpc_kubemq_pb.QueueMessagesBatchRequest)) {
    throw new Error(
      'Expected argument of type kubemq.QueueMessagesBatchRequest',
    );
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_kubemq_QueueMessagesBatchRequest(buffer_arg) {
  return src_protos_grpc_kubemq_pb.QueueMessagesBatchRequest.deserializeBinary(
    new Uint8Array(buffer_arg),
  );
}

function serialize_kubemq_QueueMessagesBatchResponse(arg) {
  if (!(arg instanceof src_protos_grpc_kubemq_pb.QueueMessagesBatchResponse)) {
    throw new Error(
      'Expected argument of type kubemq.QueueMessagesBatchResponse',
    );
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_kubemq_QueueMessagesBatchResponse(buffer_arg) {
  return src_protos_grpc_kubemq_pb.QueueMessagesBatchResponse.deserializeBinary(
    new Uint8Array(buffer_arg),
  );
}

function serialize_kubemq_ReceiveQueueMessagesRequest(arg) {
  if (!(arg instanceof src_protos_grpc_kubemq_pb.ReceiveQueueMessagesRequest)) {
    throw new Error(
      'Expected argument of type kubemq.ReceiveQueueMessagesRequest',
    );
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_kubemq_ReceiveQueueMessagesRequest(buffer_arg) {
  return src_protos_grpc_kubemq_pb.ReceiveQueueMessagesRequest.deserializeBinary(
    new Uint8Array(buffer_arg),
  );
}

function serialize_kubemq_ReceiveQueueMessagesResponse(arg) {
  if (
    !(arg instanceof src_protos_grpc_kubemq_pb.ReceiveQueueMessagesResponse)
  ) {
    throw new Error(
      'Expected argument of type kubemq.ReceiveQueueMessagesResponse',
    );
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_kubemq_ReceiveQueueMessagesResponse(buffer_arg) {
  return src_protos_grpc_kubemq_pb.ReceiveQueueMessagesResponse.deserializeBinary(
    new Uint8Array(buffer_arg),
  );
}

function serialize_kubemq_Request(arg) {
  if (!(arg instanceof src_protos_grpc_kubemq_pb.Request)) {
    throw new Error('Expected argument of type kubemq.Request');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_kubemq_Request(buffer_arg) {
  return src_protos_grpc_kubemq_pb.Request.deserializeBinary(
    new Uint8Array(buffer_arg),
  );
}

function serialize_kubemq_Response(arg) {
  if (!(arg instanceof src_protos_grpc_kubemq_pb.Response)) {
    throw new Error('Expected argument of type kubemq.Response');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_kubemq_Response(buffer_arg) {
  return src_protos_grpc_kubemq_pb.Response.deserializeBinary(
    new Uint8Array(buffer_arg),
  );
}

function serialize_kubemq_Result(arg) {
  if (!(arg instanceof src_protos_grpc_kubemq_pb.Result)) {
    throw new Error('Expected argument of type kubemq.Result');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_kubemq_Result(buffer_arg) {
  return src_protos_grpc_kubemq_pb.Result.deserializeBinary(
    new Uint8Array(buffer_arg),
  );
}

function serialize_kubemq_SendQueueMessageResult(arg) {
  if (!(arg instanceof src_protos_grpc_kubemq_pb.SendQueueMessageResult)) {
    throw new Error('Expected argument of type kubemq.SendQueueMessageResult');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_kubemq_SendQueueMessageResult(buffer_arg) {
  return src_protos_grpc_kubemq_pb.SendQueueMessageResult.deserializeBinary(
    new Uint8Array(buffer_arg),
  );
}

function serialize_kubemq_StreamQueueMessagesRequest(arg) {
  if (!(arg instanceof src_protos_grpc_kubemq_pb.StreamQueueMessagesRequest)) {
    throw new Error(
      'Expected argument of type kubemq.StreamQueueMessagesRequest',
    );
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_kubemq_StreamQueueMessagesRequest(buffer_arg) {
  return src_protos_grpc_kubemq_pb.StreamQueueMessagesRequest.deserializeBinary(
    new Uint8Array(buffer_arg),
  );
}

function serialize_kubemq_StreamQueueMessagesResponse(arg) {
  if (!(arg instanceof src_protos_grpc_kubemq_pb.StreamQueueMessagesResponse)) {
    throw new Error(
      'Expected argument of type kubemq.StreamQueueMessagesResponse',
    );
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_kubemq_StreamQueueMessagesResponse(buffer_arg) {
  return src_protos_grpc_kubemq_pb.StreamQueueMessagesResponse.deserializeBinary(
    new Uint8Array(buffer_arg),
  );
}

function serialize_kubemq_Subscribe(arg) {
  if (!(arg instanceof src_protos_grpc_kubemq_pb.Subscribe)) {
    throw new Error('Expected argument of type kubemq.Subscribe');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_kubemq_Subscribe(buffer_arg) {
  return src_protos_grpc_kubemq_pb.Subscribe.deserializeBinary(
    new Uint8Array(buffer_arg),
  );
}

var kubemqService = (exports.kubemqService = {
  sendEvent: {
    path: '/kubemq.kubemq/SendEvent',
    requestStream: false,
    responseStream: false,
    requestType: src_protos_grpc_kubemq_pb.Event,
    responseType: src_protos_grpc_kubemq_pb.Result,
    requestSerialize: serialize_kubemq_Event,
    requestDeserialize: deserialize_kubemq_Event,
    responseSerialize: serialize_kubemq_Result,
    responseDeserialize: deserialize_kubemq_Result,
  },
  sendEventsStream: {
    path: '/kubemq.kubemq/SendEventsStream',
    requestStream: true,
    responseStream: true,
    requestType: src_protos_grpc_kubemq_pb.Event,
    responseType: src_protos_grpc_kubemq_pb.Result,
    requestSerialize: serialize_kubemq_Event,
    requestDeserialize: deserialize_kubemq_Event,
    responseSerialize: serialize_kubemq_Result,
    responseDeserialize: deserialize_kubemq_Result,
  },
  subscribeToEvents: {
    path: '/kubemq.kubemq/SubscribeToEvents',
    requestStream: false,
    responseStream: true,
    requestType: src_protos_grpc_kubemq_pb.Subscribe,
    responseType: src_protos_grpc_kubemq_pb.EventReceive,
    requestSerialize: serialize_kubemq_Subscribe,
    requestDeserialize: deserialize_kubemq_Subscribe,
    responseSerialize: serialize_kubemq_EventReceive,
    responseDeserialize: deserialize_kubemq_EventReceive,
  },
  subscribeToRequests: {
    path: '/kubemq.kubemq/SubscribeToRequests',
    requestStream: false,
    responseStream: true,
    requestType: src_protos_grpc_kubemq_pb.Subscribe,
    responseType: src_protos_grpc_kubemq_pb.Request,
    requestSerialize: serialize_kubemq_Subscribe,
    requestDeserialize: deserialize_kubemq_Subscribe,
    responseSerialize: serialize_kubemq_Request,
    responseDeserialize: deserialize_kubemq_Request,
  },
  sendRequest: {
    path: '/kubemq.kubemq/SendRequest',
    requestStream: false,
    responseStream: false,
    requestType: src_protos_grpc_kubemq_pb.Request,
    responseType: src_protos_grpc_kubemq_pb.Response,
    requestSerialize: serialize_kubemq_Request,
    requestDeserialize: deserialize_kubemq_Request,
    responseSerialize: serialize_kubemq_Response,
    responseDeserialize: deserialize_kubemq_Response,
  },
  sendResponse: {
    path: '/kubemq.kubemq/SendResponse',
    requestStream: false,
    responseStream: false,
    requestType: src_protos_grpc_kubemq_pb.Response,
    responseType: src_protos_grpc_kubemq_pb.Empty,
    requestSerialize: serialize_kubemq_Response,
    requestDeserialize: deserialize_kubemq_Response,
    responseSerialize: serialize_kubemq_Empty,
    responseDeserialize: deserialize_kubemq_Empty,
  },
  sendQueueMessage: {
    path: '/kubemq.kubemq/SendQueueMessage',
    requestStream: false,
    responseStream: false,
    requestType: src_protos_grpc_kubemq_pb.QueueMessage,
    responseType: src_protos_grpc_kubemq_pb.SendQueueMessageResult,
    requestSerialize: serialize_kubemq_QueueMessage,
    requestDeserialize: deserialize_kubemq_QueueMessage,
    responseSerialize: serialize_kubemq_SendQueueMessageResult,
    responseDeserialize: deserialize_kubemq_SendQueueMessageResult,
  },
  sendQueueMessagesBatch: {
    path: '/kubemq.kubemq/SendQueueMessagesBatch',
    requestStream: false,
    responseStream: false,
    requestType: src_protos_grpc_kubemq_pb.QueueMessagesBatchRequest,
    responseType: src_protos_grpc_kubemq_pb.QueueMessagesBatchResponse,
    requestSerialize: serialize_kubemq_QueueMessagesBatchRequest,
    requestDeserialize: deserialize_kubemq_QueueMessagesBatchRequest,
    responseSerialize: serialize_kubemq_QueueMessagesBatchResponse,
    responseDeserialize: deserialize_kubemq_QueueMessagesBatchResponse,
  },
  receiveQueueMessages: {
    path: '/kubemq.kubemq/ReceiveQueueMessages',
    requestStream: false,
    responseStream: false,
    requestType: src_protos_grpc_kubemq_pb.ReceiveQueueMessagesRequest,
    responseType: src_protos_grpc_kubemq_pb.ReceiveQueueMessagesResponse,
    requestSerialize: serialize_kubemq_ReceiveQueueMessagesRequest,
    requestDeserialize: deserialize_kubemq_ReceiveQueueMessagesRequest,
    responseSerialize: serialize_kubemq_ReceiveQueueMessagesResponse,
    responseDeserialize: deserialize_kubemq_ReceiveQueueMessagesResponse,
  },
  streamQueueMessage: {
    path: '/kubemq.kubemq/StreamQueueMessage',
    requestStream: true,
    responseStream: true,
    requestType: src_protos_grpc_kubemq_pb.StreamQueueMessagesRequest,
    responseType: src_protos_grpc_kubemq_pb.StreamQueueMessagesResponse,
    requestSerialize: serialize_kubemq_StreamQueueMessagesRequest,
    requestDeserialize: deserialize_kubemq_StreamQueueMessagesRequest,
    responseSerialize: serialize_kubemq_StreamQueueMessagesResponse,
    responseDeserialize: deserialize_kubemq_StreamQueueMessagesResponse,
  },
  ackAllQueueMessages: {
    path: '/kubemq.kubemq/AckAllQueueMessages',
    requestStream: false,
    responseStream: false,
    requestType: src_protos_grpc_kubemq_pb.AckAllQueueMessagesRequest,
    responseType: src_protos_grpc_kubemq_pb.AckAllQueueMessagesResponse,
    requestSerialize: serialize_kubemq_AckAllQueueMessagesRequest,
    requestDeserialize: deserialize_kubemq_AckAllQueueMessagesRequest,
    responseSerialize: serialize_kubemq_AckAllQueueMessagesResponse,
    responseDeserialize: deserialize_kubemq_AckAllQueueMessagesResponse,
  },
  ping: {
    path: '/kubemq.kubemq/Ping',
    requestStream: false,
    responseStream: false,
    requestType: src_protos_grpc_kubemq_pb.Empty,
    responseType: src_protos_grpc_kubemq_pb.PingResult,
    requestSerialize: serialize_kubemq_Empty,
    requestDeserialize: deserialize_kubemq_Empty,
    responseSerialize: serialize_kubemq_PingResult,
    responseDeserialize: deserialize_kubemq_PingResult,
  },
});

exports.kubemqClient = grpc.makeGenericClientConstructor(kubemqService);
