import { CommandsClient } from '../../src/cq/commandsClient';
import { CQChannel } from '../../src/common/channel_stats';
import { Config } from '../../src/client/config';
import { CommandsMessage, CommandsReceiveMessageCallback, CommandsSubscriptionRequest } from '../../src/cq/commandTypes';
import * as grpc from '@grpc/grpc-js';
import * as pb from '../../src/protos';
import { ServerInterceptingCallInterface } from '@grpc/grpc-js';
import { EventEmitter } from 'events';
import { InterceptingCallInterface } from '@grpc/grpc-js/build/src/client-interceptors';

class MockClientReadableStream extends EventEmitter implements grpc.ClientReadableStream<pb.kubemq.Request> {
  call?: InterceptingCallInterface | undefined;
  readable: boolean;
  readableEncoding: BufferEncoding | null;
  readableEnded: boolean;
  readableFlowing: boolean | null;
  readableHighWaterMark: number;
  readableLength: number;
  readableObjectMode: boolean;
  destroyed: boolean;
  _read(size: number): void {
    throw new Error('Method not implemented.');
  }
  setEncoding(encoding: BufferEncoding): this {
    throw new Error('Method not implemented.');
  }
  pause(): this {
    throw new Error('Method not implemented.');
  }
  resume(): this {
    throw new Error('Method not implemented.');
  }
  isPaused(): boolean {
    throw new Error('Method not implemented.');
  }
  unpipe(destination?: NodeJS.WritableStream): this {
    throw new Error('Method not implemented.');
  }
  unshift(chunk: any, encoding?: BufferEncoding): void {
    throw new Error('Method not implemented.');
  }
  wrap(oldStream: NodeJS.ReadableStream): this {
    throw new Error('Method not implemented.');
  }
  push(chunk: any, encoding?: BufferEncoding): boolean {
    throw new Error('Method not implemented.');
  }
  _destroy(error: Error | null, callback: (error?: Error | null) => void): void {
    throw new Error('Method not implemented.');
  }
  destroy(error?: Error): void {
    throw new Error('Method not implemented.');
  }
  [Symbol.asyncIterator](): AsyncIterableIterator<any> {
    throw new Error('Method not implemented.');
  }
  pipe<T extends NodeJS.WritableStream>(destination: T, options?: { end?: boolean; } | undefined): T {
    throw new Error('Method not implemented.');
  }
  cancel() {}
  
  getPeer() {
    return 'mock-peer';
  }

  deserialize(chunk: Buffer): pb.kubemq.Request {
    const request = new pb.kubemq.Request();
    // Mock deserialization logic
    return request;
  }

  read(size?: number): pb.kubemq.Request {
    // Mock implementation of read method
    // Return a mock request object or null if no more data
    const request = new pb.kubemq.Request();
    return request; // Return null if you want to simulate end of stream
  }
}


describe('CommandsClient Integration Test', () => {
  let client: CommandsClient;
  
  beforeAll(() => {
    const config: Config = {
      address: 'localhost:50000',
      clientId: 'test-client',
    };
    client = new CommandsClient(config);
  });

  it('should send a command message and receive a response', async () => {
    const mockSendRequest = jest.spyOn(client.grpcClient as any, 'sendRequest').mockImplementation(
      (
        message: any,
        metadata: any,
        options: any,
        callback: any
      ) => {
        const response = new pb.kubemq.Response();
        response.RequestID=(message.RequestID);
        response.ClientID=(message.ClientID);
        response.Executed=(true);
  
        callback(null, response);
  
        return {
          cancel: () => {},
          getPeer: () => 'mock-peer',
          call: undefined as ServerInterceptingCallInterface | undefined,
        } as grpc.ClientUnaryCall;
      }
    );
  
    const message: CommandsMessage = {
      id: 'test-command-id',
      clientId: 'test-client',
      channel: 'test-channel',
      metadata: 'test-metadata',
      body: Buffer.from('test-body'),
      timeout: 5000,
    };
  
    const response = await client.send(message);
    expect(response).toBeDefined();
    expect(response.id).toBe(message.id);
    expect(response.clientId).toBe(message.clientId);
    expect(response.executed).toBe(true);
  
    mockSendRequest.mockRestore();
  });


  it('should subscribe to a command channel and receive messages', async () => {

    const mockSubscribeToRequests = jest.spyOn(client['grpcClient'] as any, 'subscribeToRequests').mockImplementation(
      (request: any, metadata: any, options: any) => {
        const stream = new MockClientReadableStream() as grpc.ClientReadableStream<pb.kubemq.Request>;
  
        setTimeout(() => {
          const requestData = new pb.kubemq.Request();
          requestData.RequestID=('test-request-id');
          requestData.Channel=(request.getChannel());
          stream.emit('data', requestData);
        }, 100);
  
        return stream;
      }
    );
  
    const subscriptionRequest: CommandsSubscriptionRequest = {
      clientId: 'test-client',
      channel: 'test-channel',
    };
  
    const callback = jest.fn();
    const subscription = await client.subscribe(subscriptionRequest, callback);
  
    // Wait for a short time to ensure the message is received
    await new Promise((resolve) => setTimeout(resolve, 200));
  
    expect(callback).toHaveBeenCalledWith(null, {
      id: 'test-request-id',
      channel: subscriptionRequest.channel,
      metadata: undefined,
      body: undefined,
      tags: expect.any(Object),
      replyChannel: undefined,
    });
  
    subscription.onState.emit('close');
  
    mockSubscribeToRequests.mockRestore();
  });

  

  it('should create a command channel', async () => {
    const mockCreateChannel = jest.spyOn(client['grpcClient'] as any, 'createChannel').mockImplementation(
      (request: any, metadata: any, callback: any) => {
        const response = new pb.kubemq.Response;
        response.Error=('');
        callback(null, response);
      }
    );

    await expect(client.create('test-channel')).resolves.toBeUndefined();

    mockCreateChannel.mockRestore();
  });

  it('should delete a command channel', async () => {
    const mockDeleteChannel = jest.spyOn(client['grpcClient'] as any, 'deleteChannel').mockImplementation(
      (request: any, metadata: any, callback: any) => {
        const response = new pb.kubemq.Response;
        response.Error=('');
        callback(null, response);
      }
    );

    await expect(client.delete('test-channel')).resolves.toBeUndefined();

    mockDeleteChannel.mockRestore();
  });

  it('should list command channels', async () => {
    const mockListChannels = jest.spyOn(client['grpcClient'] as any, 'listChannels').mockImplementation(
      (request: any, metadata: any, callback: any) => {
        const response = new pb.kubemq.Response();
        response.Executed=(true);
        // Simulate the response body containing a list of channel objects
        const channelList = [{ name: 'test-channel' }];
        response.Body=(new TextEncoder().encode(JSON.stringify(channelList)));
  
        callback(null, response);
      }
    );
  
    const channels = await client.list('');
    expect(channels).toBeDefined();
    expect(channels).toHaveLength(1);
    expect(channels[0].name).toBe('test-channel');
  
    mockListChannels.mockRestore();
  });
  
  
});
