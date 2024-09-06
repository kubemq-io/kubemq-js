
import * as pb from '../protos';
import {QueueMessageSendResult, QueuesPullWaitingMessagesResponse, QueueMessage, QueuesMessagesPulledResponse, QueueMessageReceived} from './queuesTypes'
import { KubeMQClient} from '../client/KubeMQClient';
import * as grpc from '@grpc/grpc-js';

export class QueueStreamHelper {
   
    private queuesUpStreamHandler: grpc.ClientWritableStream<pb.kubemq.QueuesUpstreamRequest> | null = null;
    private queuesDownstreamHandler: grpc.ClientWritableStream<pb.kubemq.QueuesDownstreamRequest> | null = null;

    public async sendMessage(kubeMQClient: KubeMQClient, queueMessage: pb.kubemq.QueuesUpstreamRequest): Promise<QueueMessageSendResult> {
        return new Promise<QueueMessageSendResult>((resolve, reject) => {
            if (!this.queuesUpStreamHandler) {
                // Initiate the duplex stream for both sending and receiving messages
                const duplexStream: grpc.ClientDuplexStream<pb.kubemq.QueuesUpstreamRequest, pb.kubemq.QueuesUpstreamResponse> =
                    kubeMQClient.grpcClient.QueuesUpstream();
    
                // Listen for data (responses from the server)
                duplexStream.on('data', (messageReceive: pb.kubemq.QueuesUpstreamResponse) => {
                    console.log(`QueuesUpstreamResponse Received: ${messageReceive}`);
    
                    if (!messageReceive.IsError) {
                        const qsr: QueueMessageSendResult = {
                            id: messageReceive.Results[0].MessageID || '',
                            sentAt: messageReceive.Results[0].SentAt > 0 ? messageReceive.Results[0].SentAt / 1000000000 : 0,
                            expirationAt: messageReceive.Results[0].ExpirationAt > 0 ? messageReceive.Results[0].ExpirationAt / 1000000000 : 0,
                            delayedTo: messageReceive.Results[0].DelayedTo > 0 ? messageReceive.Results[0].DelayedTo / 1000000000 : 0,
                            isError: messageReceive.IsError,
                            error: messageReceive.Error || '',
                        };
                        resolve(qsr);
                    } else {
                        const qsr: QueueMessageSendResult = {
                            id: '',
                            sentAt: 0,
                            expirationAt: 0,
                            delayedTo: 0,
                            isError: true,
                            error: messageReceive.Error || '',
                        };
                        resolve(qsr);
                    }
                });
    
                // Handle stream errors
                duplexStream.on('error', (err: grpc.ServiceError) => {
                    console.error('Error in QueuesUpstreamResponse:', err);
                    const qpResp: QueueMessageSendResult = {
                        id: '',
                        sentAt: 0,
                        expirationAt: 0,
                        delayedTo: 0,
                        isError: true,
                        error: err.message,
                    };
                    reject(qpResp);
                });
    
                duplexStream.on('end', () => {
                    console.log('QueuesUpstreamResponse stream ended.');
                });
    
                // Assign duplexStream as the handler for future messages
                this.queuesUpStreamHandler = duplexStream;
            }
    
            // Write the message to the duplex stream (sending the request)
            if (this.queuesUpStreamHandler) {
                this.queuesUpStreamHandler.write(queueMessage);
            }
        });
    }
    
    
    public async receiveMessage(kubeMQClient: KubeMQClient, queuesPollRequest: pb.kubemq.QueuesDownstreamRequest): Promise<QueuesMessagesPulledResponse> {
        return new Promise<QueuesMessagesPulledResponse>((resolve, reject) => {
            if (!this.queuesDownstreamHandler) {
                // Initiate the duplex stream for both sending and receiving messages
                const duplexStream: grpc.ClientDuplexStream<pb.kubemq.QueuesDownstreamRequest, pb.kubemq.QueuesDownstreamResponse> = 
                    kubeMQClient.grpcClient.QueuesDownstream();
    
                // Listen for responses (data) from the server
                duplexStream.on('data', (messageReceive: pb.kubemq.QueuesDownstreamResponse) => {
                    console.log(`QueuesDownstreamResponse Received->: ${messageReceive}`);
                    const qpResp: QueuesMessagesPulledResponse = {
                        id: messageReceive.RefRequestId,
                        messages: [],
                        messagesReceived: messageReceive.Messages.length,
                        messagesExpired: 0, // You may need to adjust this based on your logic
                        isPeek: false, // Adjust based on your logic
                        isError: messageReceive.IsError,
                        error: messageReceive.Error || '',
                    };
    
                    // Decode the received messages and push them to the `messages` array
                    for (const qm of messageReceive.Messages) {
                        qpResp.messages.push(
                            QueueMessageReceived.decode(
                                qm,
                                messageReceive.TransactionId, 
                                messageReceive.TransactionComplete,
                                '', // Assuming `receiverClientId`
                                this.queuesDownstreamHandler
                            )
                        );
                    }
    
                    resolve(qpResp);
                });
    
                // Handle errors from the server
                duplexStream.on('error', (err: grpc.ServiceError) => {
                    console.error('Error in QueuesDownstreamResponse:', err);
                    const qpResp: QueuesMessagesPulledResponse = {
                        id: '',
                        messages: [],
                        messagesReceived: 0,
                        messagesExpired: 0,
                        isPeek: false,
                        isError: true,
                        error: err.message,
                    };
                    reject(qpResp);
                });
    
                // Handle end of the stream
                duplexStream.on('end', () => {
                    console.log('QueuesDownstreamResponse stream ended.');
                });
    
                // Assign duplexStream to handle future messages
                this.queuesDownstreamHandler = duplexStream;
            }
    
            // Write the request to the duplex stream (sending the request)
            if (this.queuesDownstreamHandler) {
                this.queuesDownstreamHandler.write(queuesPollRequest);
            }
        });
    }
    
}
