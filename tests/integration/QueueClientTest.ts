import { QueuesClient } from '../../src/queues/QueuesClient';
import { Config } from '../../src/client/config';
import * as grpc from '@grpc/grpc-js';
import * as pb from '../../src/protos';
import { QueueMessage, QueueMessageSendResult, QueuesAckAllMessagesRequest, QueuesAckAllMessagesResponse, QueuesPullPeekMessagesRequest } from '../../src/queues/queuesTypes';


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
    const mockSendQueueMessage = jest.spyOn(client.grpcClient, 'sendQueueMessage').mockImplementation(
      (
        request: pb.QueueMessage,
        metadata: grpc.Metadata | null,
        options: grpc.CallOptions | null,
        callback: grpc.requestCallback<pb.SendQueueMessageResult>
      ) => {
        const response = new pb.SendQueueMessageResult
        response.setMessageid(request.getMessageid());
        response.setIserror(false);

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

    const response = await client.send(message);
    expect(response).toBeDefined();
    expect(response.id).toBe(message.id);
    expect(response.isError).toBe(false);

    mockSendQueueMessage.mockRestore();
  });

  it('should delete a queue channel', async () => {
    const mockDeleteChannel = jest.spyOn(client['grpcClient'] as any, 'deleteChannel').mockImplementation(
      (request: any, metadata: any, callback: any) => {
        const response = new pb.Response;
        response.setExecuted(true);
        response.setError('');
        callback(null, response);
      }
    );

    await expect(client.delete('test-channel')).resolves.toBeUndefined();

    mockDeleteChannel.mockRestore();
  });


  it('should list queue channels', async () => {
    const mockListChannels = jest.spyOn(client.grpcClient as any, 'listQueuesChannels').mockImplementation(
      (request: any, metadata: any, callback: any) => {
        const response = new pb.Response();
        response.setExecuted(true);
        // Simulate the response body containing a list of channel objects
        const channelList = [{ name: 'test-channel' }];
        response.setBody(JSON.stringify(channelList));
        callback(null, response);
      }
    );

    const channels = await client.list('');
    expect(channels).toBeDefined();
    expect(channels).toHaveLength(1);
    expect(channels[0].name).toBe('test-channel');

    mockListChannels.mockRestore();
  });

  it('should peek queue messages', async () => {
    const mockPeekMessages = jest.spyOn(client.grpcClient as any, 'receiveQueueMessages').mockImplementation(
      (request: any, metadata: any, callback: any) => {
        const response = new pb.ReceiveQueueMessagesResponse();
        const message = new pb.QueueMessage();
        message.setMessageid('test-message-id');
        message.setChannel(request.getChannel());
        response.addMessages(message);
        response.setIspeak(true);
        callback(null, response);
      }
    );

    const queuePollRequest: QueuesPullPeekMessagesRequest = {
        id: 'unique-request-id',
        channel: 'my-channel',
        clientId: 'my-client-id',
        maxNumberOfMessages: 10,
        waitTimeoutSeconds: 30,
      };
    const messages = await client.peek(queuePollRequest);
    expect(messages).toBeDefined();
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe('test-message-id');

    mockPeekMessages.mockRestore();
  });

  it('should acknowledge all queue messages', async () => {
    const mockAckAllMessages = jest.spyOn(client.grpcClient as any, 'ackAllQueueMessages').mockImplementation(
      (request: any, metadata:any, callback: any) => {
        const response = new pb.Response();
        response.setExecuted(true);
        callback(null, response);
      }
    );

    const ack: QueuesAckAllMessagesRequest = {
        clientId: 'test-client',
        channel: 'test-channel',
        waitTimeoutSeconds: 0
    };
    await expect(client.ackAll(ack)).resolves.toBeUndefined();
    mockAckAllMessages.mockRestore();
  });

  it('should receive queue messages', async () => {
    const mockReceiveMessages = jest.spyOn(client.grpcClient as any, 'receiveQueueMessages').mockImplementation(
      (request: any, metadata: any, callback: any) => {
        const response = new pb.ReceiveQueueMessagesResponse();
        const message = new pb.QueueMessage();
        message.setMessageid('test-message-id');
        message.setChannel(request.getChannel());
        response.addMessages(message);
        response.setIserror(false);
        callback(null, response);
      }
    );

    const pullQueueMessageRequest: QueuesPullPeekMessagesRequest = {
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
