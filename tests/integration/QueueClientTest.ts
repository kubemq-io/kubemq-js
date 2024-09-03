import { QueuesClient } from '../../src/queues/QueuesClient';
import { Config } from '../../src/client/config';
import * as grpc from '@grpc/grpc-js';
import * as pb from '../../src/protos';
import { QueueMessage, QueueMessageSendResult, QueuesAckAllMessagesRequest, QueuesPullWaitngMessagesRequest } from '../../src/queues/queuesTypes';
import { UnaryCallback } from '@grpc/grpc-js/build/src/client';


describe('QueuesClient Integration Test', () => {
  let client: QueuesClient;

  beforeAll(() => {
    const config: Config = {
      address: 'localhost:50000',
      clientId: 'test-client',
    };
    client = new QueuesClient(config);
  });

  it('should send a queue message', async () => {
    const mockSendQueueMessage = jest.spyOn(client.grpcClient as any, 'sendQueueMessage').mockImplementation(
      (
        request: any,
        metadata: any,
        options: any,
        callback: any
      ) => {
        const response = new pb.kubemq.SendQueueMessageResult
        response.MessageID=(request.getMessageid());
        response.IsError=(false);

        callback(null, response);

        return {
          cancel: () => {},
          getPeer: () => 'mock-peer',
        } as grpc.ClientUnaryCall;
      }
    );

    const message: QueueMessage = {
      id: 'test-message-id',
      clientId: 'test-client',
      channel: 'test-channel',
      body: Buffer.from('test-body'),
    };

    const response = await client.sendQueuesMessage(message);
    expect(response).toBeDefined();
    expect(response.id).toBe(message.id);
    expect(response.isError).toBe(false);

    mockSendQueueMessage.mockRestore();
  });

  it('should delete a queue channel', async () => {
    const mockDeleteChannel = jest.spyOn(client['grpcClient'] as any, 'deleteChannel').mockImplementation(
      (request: any, metadata: any, callback: any) => {
        const response = new pb.kubemq.Response;
        response.Executed=(true);
        response.Error=('');
        callback(null, response);
      }
    );

    await expect(client.deleteQueuesChannel('test-channel')).resolves.toBeUndefined();

    mockDeleteChannel.mockRestore();
  });


  it('should list queue channels', async () => {
    const mockListChannels = jest.spyOn(client.grpcClient as any, 'listQueuesChannels').mockImplementation(
      (request: any, metadata: any, callback: any) => {
        const response = new pb.kubemq.Response();
        response.Executed=(true);
        // Simulate the response body containing a list of channel objects
        const channelList = [{ name: 'test-channel' }];
        response.Body= new TextEncoder().encode(JSON.stringify(channelList));
        callback(null, response);
      }
    );

    const channels = await client.listQueuesChannel('');
    expect(channels).toBeDefined();
    expect(channels).toHaveLength(1);
    expect(channels[0].name).toBe('test-channel');

    mockListChannels.mockRestore();
  });

  it('should waiting queue messages', async () => {
    const mockPeekMessages = jest.spyOn(client.grpcClient as any, 'receiveQueueMessages').mockImplementation(
      (request: any, metadata: any, callback: any) => {
        const response = new pb.kubemq.ReceiveQueueMessagesResponse();
        const message = new pb.kubemq.QueueMessage();
        message.MessageID=('test-message-id');
        message.Channel=(request.getChannel());
        response.Messages.push(message);
        response.IsPeak=(false);
        callback(null, response);
      }
    );

    const queuePollRequest: QueuesPullWaitngMessagesRequest = {
        id: 'unique-request-id',
        channel: 'my-channel',
        clientId: 'my-client-id',
        maxNumberOfMessages: 10,
        waitTimeoutSeconds: 30,
      };
    const messages = await client.waiting(queuePollRequest);
    expect(messages).toBeDefined();
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe('test-message-id');

    mockPeekMessages.mockRestore();
  });

  it('should receive queue messages', async () => {
    const mockReceiveMessages = jest.spyOn(client.grpcClient as any, 'receiveQueueMessages').mockImplementation(
      (request: any, metadata: any, callback: any) => {
        const response = new pb.kubemq.ReceiveQueueMessagesResponse();
        const message = new pb.kubemq.QueueMessage();
        message.MessageID=('test-message-id');
        message.Channel=(request.getChannel());
        response.Messages.push(message);
        response.IsError=(false);
        callback(null, response);
      }
    );

    const pullQueueMessageRequest: QueuesPullWaitngMessagesRequest = {
        id: 'unique-request-id',
        channel: 'my-channel',
        clientId: 'my-client-id',
        maxNumberOfMessages: 10,
        waitTimeoutSeconds: 30,
      };

    const messages = await client.pull(pullQueueMessageRequest);
    expect(messages).toBeDefined();
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe('test-message-id');

    mockReceiveMessages.mockRestore();
  });
});
