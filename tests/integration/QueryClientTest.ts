import { QueriesClient } from '../../src/cq/queriesClient';
import { Config } from '../../src/client/config';
import * as pb from '../../src/protos';
import * as grpc from '@grpc/grpc-js';
import { TypedEvent } from '../../src/client/KubeMQClient';
import { createChannel, deleteChannel, listCQChannels } from '../../src/common/common';
import { CQChannel } from '../../src/common/channel_stats';

// Mock gRPC methods and utility functions
const mockSendRequest = jest.fn();
const mockSendResponse = jest.fn();
const mockSubscribeToRequests = jest.fn();
const mockCreateChannel = jest.fn();
const mockDeleteChannel = jest.fn();
const mockListCQChannels = jest.fn();

// Create a mock grpcClient
const mockGrpcClient = {
  sendRequest: mockSendRequest,
  sendResponse: mockSendResponse,
  subscribeToRequests: mockSubscribeToRequests,
} as unknown as grpc.Client;

// Define a sample configuration
const config: Config = {
  address: 'localhost:50051',
  clientId: 'test-client',
};

// Initialize QueriesClient with the mock gRPC client
const queriesClient = new QueriesClient(config);
(queriesClient as any).grpcClient = mockGrpcClient;

// Mock utility functions
jest.mock('../../src/common/common', () => ({
  createChannel: mockCreateChannel,
  deleteChannel: mockDeleteChannel,
  listCQChannels: mockListCQChannels,
}));

describe('QueriesClient Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('send() should send a message and return a response', async () => {
    const response = new pb.Response();
    response.setRequestid('123');
    response.setClientid('test-client');
    response.setError('');
    response.setExecuted(true);
    response.setTimestamp(Date.now());
    response.setBody('response-body');
    response.setMetadata('');
    response.getTagsMap().set('key', 'value');

    mockSendRequest.mockImplementation((_, __, callback) => callback(null, response));

    const message = {
      id: '123',
      clientId: 'test-client',
      channel: 'test-channel',
      body: 'test-body',
      metadata: '',
      tags: new Map([['key', 'value']]),
      timeout: 30,
      cacheKey: '',
      cacheTTL: 0,
    };

    const result = await queriesClient.send(message);
    expect(result).toEqual({
      id: '123',
      clientId: 'test-client',
      error: '',
      executed: true,
      timestamp: expect.any(Number),
      body: 'response-body',
      metadata: '',
      tags: new Map([['key', 'value']]),
    });
  });

  test('response() should send a response successfully', async () => {
    mockSendResponse.mockImplementation((_, __, callback) => callback(null));

    const response = {
      id: '123',
      clientId: 'test-client',
      replyChannel: 'reply-channel',
      error: '',
      executed: true,
      timestamp: 10,
      body: 'response-body',
      metadata: '',
      tags: new Map([['key', 'value']]),
    };

    await expect(queriesClient.response(response)).resolves.toBeUndefined();
  });

  test('subscribe() should handle subscription and reconnect', async () => {
    const mockStream = {
      on: jest.fn().mockImplementation((event, callback) => {
        if (event === 'data') {
          callback(new pb.Request());
        }
        if (event === 'close') {
          callback();
        }
      }),
      cancel: jest.fn(),
    } as unknown as grpc.ClientReadableStream<pb.Request>;

    mockSubscribeToRequests.mockResolvedValue({
      onClose: new TypedEvent<void>(),
      stream: mockStream,
    });

    const request = {
      clientId: 'test-client',
      channel: 'test-channel',
    };

    const callback = jest.fn();

    const subscription = await queriesClient.subscribe(request, callback);

    expect(mockSubscribeToRequests).toHaveBeenCalled();
    expect(callback).toHaveBeenCalled();
    expect(subscription).toBeDefined();
  });

  test('create() should create a channel successfully', async () => {
    mockCreateChannel.mockResolvedValue(undefined);

    const channelName = 'test-channel';

    await expect(queriesClient.create(channelName)).resolves.toBeUndefined();
    expect(mockCreateChannel).toHaveBeenCalledWith(
      mockGrpcClient,
      expect.anything(),
      config.clientId,
      channelName,
      'queries'
    );
  });

  test('delete() should delete a channel successfully', async () => {
    mockDeleteChannel.mockResolvedValue(undefined);

    const channelName = 'test-channel';

    await expect(queriesClient.delete(channelName)).resolves.toBeUndefined();
    expect(mockDeleteChannel).toHaveBeenCalledWith(
      mockGrpcClient,
      expect.anything(),
      config.clientId,
      channelName,
      'queries'
    );
  });

  test('list() should list channels successfully', async () => {
    const mockChannels: CQChannel[] = [{
      type: '1', name: 'test-channel',
      lastActivity: 0,
      isActive: false,
      incoming: {
        messages: 0,
        volume: 0,
        responses: 0
      },
      outgoing: {
        messages: 0,
        volume: 0,
        responses: 0
      }
    }];
    mockListCQChannels.mockResolvedValue(mockChannels);

    const search = 'test';

    const result = await queriesClient.list(search);

    expect(result).toEqual(mockChannels);
    expect(mockListCQChannels).toHaveBeenCalledWith(
      mockGrpcClient,
      expect.anything(),
      config.clientId,
      search,
      'queries'
    );
  });
});
