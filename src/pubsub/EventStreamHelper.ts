import { KubeMQClient } from '../client/KubeMQClient';
import { EventsSendResult } from '../pubsub/eventTypes';
import * as pb from '../protos';
import * as grpc from '@grpc/grpc-js';

export class EventStreamHelper {
  private queuesUpStreamHandler: grpc.ClientDuplexStream<pb.kubemq.Event, pb.kubemq.Result> | null = null;
  private pendingPromises: Map<string, { resolve: (result: EventsSendResult) => void; reject: (error: EventsSendResult) => void }> = new Map();

  constructor() {
    // Initialize the stream when the class is instantiated
    this.initializeStream();
  }

  /**
   * Initializes the duplex stream and sets up event handlers for the stream.
   */
  private initializeStream(kubeMQClient?: KubeMQClient) {
    if (!this.queuesUpStreamHandler && kubeMQClient) {
      this.queuesUpStreamHandler = kubeMQClient.grpcClient.SendEventsStream();

      this.queuesUpStreamHandler.on('data', (result: pb.kubemq.Result) => {
        const eventId = result.EventID;
        const handlers = this.pendingPromises.get(eventId);
        if (handlers) {
          handlers.resolve(EventsSendResult.decode(result));
          this.pendingPromises.delete(eventId);
        }
      });

      this.queuesUpStreamHandler.on('error', (err: grpc.ServiceError) => {
        console.error('Stream error:', err);
        this.pendingPromises.forEach(({ reject }, eventId) => {
          reject(new EventsSendResult(eventId, false, err.message));
        });
        this.pendingPromises.clear();
        this.queuesUpStreamHandler = null; // Reset stream on error
      });

      this.queuesUpStreamHandler.on('end', () => {
        console.log('Stream ended.');
        this.queuesUpStreamHandler = null; // Reset stream when ended
      });
    }
  }

  /**
   * Sends an event without waiting for a response.
   * @param kubeMQClient - The KubeMQ client
   * @param event - The event to send
   */
  public async sendEventMessage(kubeMQClient: KubeMQClient, event: pb.kubemq.Event): Promise<void> {
    this.initializeStream(kubeMQClient);

    if (!this.queuesUpStreamHandler) {
      throw new Error('Stream is not available');
    }

    // Send the event through the stream
    this.queuesUpStreamHandler.write(event);
    console.log('Event Message sent');
  }

  /**
   * Sends an event and waits for a response.
   * @param kubeMQClient - The KubeMQ client
   * @param event - The event to send
   * @returns The response from the server
   */
  public async sendEventStoreMessage(kubeMQClient: KubeMQClient, event: pb.kubemq.Event): Promise<EventsSendResult> {
    this.initializeStream(kubeMQClient);

    if (!this.queuesUpStreamHandler) {
      throw new Error('Stream is not available');
    }

    const eventId = event.EventID;
    const futureResponse = new Promise<EventsSendResult>((resolve, reject) => {
      this.pendingPromises.set(eventId, { resolve, reject });
    });

    // Send the event
    this.queuesUpStreamHandler.write(event);
    console.log('Event store Message sent, waiting for response');

    try {
      return await futureResponse;
    } catch (err) {
      console.error('Error waiting for response: ', err);
      throw new Error('Failed to get response');
    }
  }
}
