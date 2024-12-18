import { KubeMQClient } from '../client/KubeMQClient';
import { EventsSendResult } from '../pubsub/eventTypes';
import * as pb from '../protos';
import * as grpc from '@grpc/grpc-js';

export class EventStreamHelper {
  private queuesUpStreamHandler: grpc.ClientDuplexStream<
    pb.kubemq.Event,
    pb.kubemq.Result
  > | null = null;
  private futureResponse: Promise<EventsSendResult>;
  private resolveResponse!: (result: EventsSendResult) => void;
  private rejectResponse!: (error: EventsSendResult) => void;

  constructor() {
    this.futureResponse = new Promise<EventsSendResult>((resolve, reject) => {
      this.resolveResponse = resolve;
      this.rejectResponse = reject;
    });
  }

  public async sendEventMessage(
    kubeMQClient: KubeMQClient,
    event: pb.kubemq.Event,
  ): Promise<void> {
    if (!this.queuesUpStreamHandler) {
      this.queuesUpStreamHandler = kubeMQClient.grpcClient.SendEventsStream();

      // Setup handlers for the duplex stream
      this.queuesUpStreamHandler.on('data', (result: pb.kubemq.Result) => {
        this.resolveResponse(EventsSendResult.decode(result));
      });

      this.queuesUpStreamHandler.on('error', (err: Error) => {
        console.error('Error in EventSendResult: ', err);
        const sendResult = new EventsSendResult();
        sendResult.error = err.message;
        this.rejectResponse(sendResult);
      });

      this.queuesUpStreamHandler.on('end', () => {
        console.log('EventSendResult onCompleted.');
      });
    }

    // Send the event
    this.queuesUpStreamHandler.write(event);
  }

  public async sendEventStoreMessage(
    kubeMQClient: KubeMQClient,
    event: pb.kubemq.Event,
  ): Promise<EventsSendResult> {
    if (!this.queuesUpStreamHandler) {
      this.queuesUpStreamHandler = kubeMQClient.grpcClient.SendEventsStream();

      // Setup handlers for the duplex stream
      this.queuesUpStreamHandler.on('data', (result: pb.kubemq.Result) => {
        this.resolveResponse(EventsSendResult.decode(result));
      });

      this.queuesUpStreamHandler.on('error', (err: Error) => {
        console.error('Error in EventSendResult: ', err);
        const sendResult = new EventsSendResult();
        sendResult.error = err.message;
        this.rejectResponse(sendResult);
      });

      this.queuesUpStreamHandler.on('end', () => {
        console.log('EventSendResult onCompleted.');
      });
    }

    // Send the event
    this.queuesUpStreamHandler.write(event);

    try {
      return await this.futureResponse;
    } catch (err) {
      console.error('Error waiting for response: ', err);
      throw new Error('Failed to get response');
    }
  }
}
