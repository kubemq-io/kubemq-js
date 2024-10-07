import * as pb from '../protos'; // Assuming pb is the KubeMQ protobufs
import { QueueMessageSendResult, QueuesMessagesPulledResponse, QueueMessageReceived } from './queuesTypes';
import { KubeMQClient } from '../client/KubeMQClient';
import * as grpc from '@grpc/grpc-js';

export class QueueStreamHelper {
  private queuesUpStreamHandler: grpc.ClientWritableStream<pb.kubemq.QueuesUpstreamRequest> | null = null;
  private queuesDownstreamHandler: grpc.ClientWritableStream<pb.kubemq.QueuesDownstreamRequest> | null = null;

  /**
   * Sends a message to KubeMQ using a duplex stream.
   * @param kubeMQClient - The KubeMQ client instance.
   * @param queueMessage - The upstream request message to send.
   * @returns A promise that resolves with the result of the send operation.
   */
  public async sendMessage(
    kubeMQClient: KubeMQClient,
    queueMessage: pb.kubemq.QueuesUpstreamRequest
  ): Promise<QueueMessageSendResult> {
    return new Promise<QueueMessageSendResult>((resolve, reject) => {
      if (!this.queuesUpStreamHandler) {
        // Create a duplex stream for upstream communication
        const duplexStream = kubeMQClient.grpcClient.QueuesUpstream();

        duplexStream.on('data', (response: pb.kubemq.QueuesUpstreamResponse) => {
          console.log(`QueuesUpstreamResponse Received: ${response}`);

          const result = this.createQueueMessageSendResult(response);
          resolve(result);
        });

        duplexStream.on('error', (err: grpc.ServiceError) => {
          console.error('Error in QueuesUpstreamResponse:', err);
          reject(this.createErrorResult(err.message));
        });

        duplexStream.on('end', () => {
          console.log('QueuesUpstreamResponse stream ended.');
        });

        this.queuesUpStreamHandler = duplexStream;
      }

      // Write the message to the duplex stream
      this.queuesUpStreamHandler?.write(queueMessage);
    });
  }

  /**
   * Receives a message from KubeMQ using a duplex stream.
   * @param kubeMQClient - The KubeMQ client instance.
   * @param queuesPollRequest - The downstream request to send.
   * @param visibilitySeconds - Visibility timeout for messages.
   * @param autoAckMessages - Indicates whether messages are auto-acknowledged.
   * @returns A promise that resolves with the pulled message response.
   */
  public async receiveMessage(
    kubeMQClient: KubeMQClient,
    queuesPollRequest: pb.kubemq.QueuesDownstreamRequest,
    visibilitySeconds: number,
    autoAckMessages: boolean
  ): Promise<QueuesMessagesPulledResponse> {
    return new Promise<QueuesMessagesPulledResponse>((resolve, reject) => {
      if (!this.queuesDownstreamHandler) {
        // Create a duplex stream for downstream communication
        const duplexStream = kubeMQClient.grpcClient.QueuesDownstream();

        duplexStream.on('data', (response: pb.kubemq.QueuesDownstreamResponse) => {
          console.log(`QueuesDownstreamResponse Received: ${response}`);

          const qpResp = this.createQueuesMessagesPulledResponse(response, visibilitySeconds, autoAckMessages);
          resolve(qpResp);
        });

        duplexStream.on('error', (err: grpc.ServiceError) => {
          console.error('Error in QueuesDownstreamResponse:', err);
          reject(this.createErrorResponse(err.message));
        });

        duplexStream.on('end', () => {
          console.log('QueuesDownstreamResponse stream ended.');
        });

        this.queuesDownstreamHandler = duplexStream;
      }

      // Write the poll request to the duplex stream
      this.queuesDownstreamHandler?.write(queuesPollRequest);
    });
  }

  /**
   * Creates a `QueueMessageSendResult` object from the upstream response.
   * @param response - The upstream response from KubeMQ.
   * @returns The constructed `QueueMessageSendResult`.
   */
  private createQueueMessageSendResult(response: pb.kubemq.QueuesUpstreamResponse): QueueMessageSendResult {
    const result = response.Results[0];

    return {
      id: result?.MessageID || '',
      sentAt: result?.SentAt > 0 ? result.SentAt / 1_000_000_000 : 0,
      expirationAt: result?.ExpirationAt > 0 ? result.ExpirationAt / 1_000_000_000 : 0,
      delayedTo: result?.DelayedTo > 0 ? result.DelayedTo / 1_000_000_000 : 0,
      isError: response.IsError,
      error: response.Error || '',
    };
  }

  /**
   * Creates an error result object for failed upstream messages.
   * @param errorMessage - The error message from the failed operation.
   * @returns The constructed `QueueMessageSendResult` indicating failure.
   */
  private createErrorResult(errorMessage: string): QueueMessageSendResult {
    return {
      id: '',
      sentAt: 0,
      expirationAt: 0,
      delayedTo: 0,
      isError: true,
      error: errorMessage,
    };
  }

  /**
   * Creates a `QueuesMessagesPulledResponse` object from the downstream response.
   * @param response - The downstream response from KubeMQ.
   * @param visibilitySeconds - The visibility timeout for pulled messages.
   * @param autoAckMessages - Indicates whether messages are auto-acknowledged.
   * @returns The constructed `QueuesMessagesPulledResponse`.
   */
  private createQueuesMessagesPulledResponse(
    response: pb.kubemq.QueuesDownstreamResponse,
    visibilitySeconds: number,
    autoAckMessages: boolean
  ): QueuesMessagesPulledResponse {

    const pulledResponse = new QueuesMessagesPulledResponse(
      response.RefRequestId, // id
      [], // messages (empty initially, can be set later)
      response.Messages.length, // messagesReceived
      0, // messagesExpired
      false, // isPeek
      response.IsError, // isError
      response.Error || '', // error
      visibilitySeconds, // visibilitySeconds
      autoAckMessages // isAutoAcked
    );

    pulledResponse.activeOffsets =response.ActiveOffsets;
    pulledResponse.responseHandler = this.queuesDownstreamHandler;
    pulledResponse.receiverClientId = response.TransactionId;
    pulledResponse.transactionId = response.TransactionId;


    // Decode the received messages
    for (const message of response.Messages) {
      const decodedMessage = QueueMessageReceived.decode(
        message,
        response.TransactionId,
        response.TransactionComplete,
        '', // Assuming receiverClientId (could be added as a parameter if needed)
        this.queuesDownstreamHandler,
        visibilitySeconds,
        autoAckMessages
      );
      pulledResponse.messages.push(decodedMessage);
    }

    return pulledResponse;
  }

/**
 * Creates an error response object for failed downstream messages.
 * @param errorMessage - The error message from the failed operation.
 * @returns The constructed `QueuesMessagesPulledResponse` indicating failure.
 */
private createErrorResponse(errorMessage: string): QueuesMessagesPulledResponse {
  return new QueuesMessagesPulledResponse(
    '',          // id
    [],          // messages (empty)
    0,           // messagesReceived
    0,           // messagesExpired
    false,       // isPeek
    true,        // isError (set to true to indicate failure)
    errorMessage,// error message from the failed operation
    0,           // visibilitySeconds
    false        // isAutoAcked (set to false as it's an error)
  );
}

}
