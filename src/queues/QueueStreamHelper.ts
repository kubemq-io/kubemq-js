
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
               
                // Initiate a separate readable stream for receiving responses
                const responseStream: grpc.ClientReadableStream<pb.kubemq.QueuesUpstreamResponse> = kubeMQClient.grpcClient.queuesUpstream();

                responseStream.on('data', (messageReceive: pb.kubemq.QueuesUpstreamResponse) => {
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

                responseStream.on('error', (err: grpc.ServiceError) => {
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

                responseStream.on('end', () => {
                    console.log('QueuesUpstreamResponse stream ended.');
                });

                // Initiate the writable stream for sending requests
                this.queuesUpStreamHandler = kubeMQClient.grpcClient.queuesUpstream(responseStream);
            }

            // Write the message to the writable stream
            if (this.queuesUpStreamHandler) {
                this.queuesUpStreamHandler.write(queueMessage);
            }
        });
    }

    public async receiveMessage(kubeMQClient: KubeMQClient, queuesPollRequest: pb.kubemq.QueuesDownstreamRequest): Promise<QueuesMessagesPulledResponse> {
        return new Promise<QueuesMessagesPulledResponse>((resolve, reject) => {
            if (!this.queuesDownstreamHandler) {

                const request: grpc.ClientReadableStream<pb.kubemq.QueuesDownstreamResponse> = kubeMQClient.grpcClient.queuesDownstream();

                request.on('data', (messageReceive: pb.kubemq.QueuesDownstreamResponse) => {
                    console.log(`QueuesDownstreamResponse Received: ${messageReceive}`);
                    const qpResp: QueuesMessagesPulledResponse = {
                        id: messageReceive.RefRequestId,
                        messages: [],
                        messagesReceived: messageReceive.Messages.length,
                        messagesExpired: 0, // Assuming you need to calculate or assign this value based on your business logic
                        isPeek: false, // Assuming a default value, you may need to adjust this based on your logic
                        isError: messageReceive.IsError,
                        error: messageReceive.Error,
                    };

                    // Push decoded messages into the `messages` array
                    for (const qm of messageReceive.Messages) {
                          
                        qpResp.messages.push(
                            QueueMessageReceived.decode(
                            qm, 
                            qpResp.id, // assuming this as transactionId (adjust if necessary)
                            false, // assuming `isTransactionCompleted` (adjust if necessary)
                            '', // assuming `receiverClientId` (adjust if necessary)
                            this.queuesDownstreamHandler
                        )
                        );
                    }

                    resolve(qpResp);
                });

                request.on('error', (err: grpc.ServiceError) => {
                    console.error('Error in QueuesDownstreamResponse:', err);
                    const qpResp: QueuesPullWaitingMessagesResponse = {
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

                request.on('end', () => {
                    console.log('QueuesDownstreamResponse stream ended.');
                });

                this.queuesDownstreamHandler =  kubeMQClient.grpcClient.queuesDownstream(request);
            }

            this.queuesDownstreamHandler.write(queuesPollRequest);
        });
    }
}
