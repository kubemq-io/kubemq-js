import { EventsClient, EventsStoreClient } from '../../src/pubsub/eventClient';
import { Config } from '../../src/client/config';
import { PubSubChannel } from '../../src/common/channel_stats';
import { EventsMessage, EventsStoreMessage, EventStoreType } from '../../src/pubsub/eventTypes';

describe('EventsStoreClient Integration Tests', () => {
    let client: EventsStoreClient;
    const config: Config = { /* Your Config Here */ };

    beforeAll(() => {
        client = new EventsStoreClient(config);
    });

    it('should send an event to the store successfully', async () => {
        const msg: EventsStoreMessage = {
            id: 'test-event-store-id',
            clientId: 'test-client-id',
            channel: 'test-channel',
            body: Buffer.from('test-body'),
            metadata: 'test-metadata',
            tags: new Map([['key1', 'value1']]),
        };

        const result = await client.send(msg);
        expect(result.sent).toBe(true);
        expect(result.id).toBe(msg.id);
    });

    it('should stream events to the store successfully', async () => {
        const response = await client.stream((err, result) => {
            expect(err).toBeNull();
            if (result) {
                expect(result.id).toBeDefined();
                expect(result.sent).toBe(true);
            }
        });

        expect(response).toBeDefined();
        expect(response.onClose).toBeDefined();

        // Simulate sending an event
        response.write({
            id: 'test-stream-event-store-id',
            clientId: 'test-client-id',
            channel: 'test-channel',
            body: Buffer.from('test-body'),
            metadata: 'test-metadata',
            tags: new Map([['key1', 'value1']]),
        });

        response.end();
    });

    it('should subscribe to events store successfully', async () => {
        const subscriptionResponse = await client.subscribe(
            {
                channel: 'test-channel',
                requestType: EventStoreType.StartNewOnly
            },
            (err, event) => {
                expect(err).toBeNull();
                if (event) {
                    expect(event.id).toBeDefined();
                    expect(event.channel).toBe('test-channel');
                }
            }
        );

        expect(subscriptionResponse).toBeDefined();
        expect(subscriptionResponse.onState).toBeDefined();
        expect(subscriptionResponse.unsubscribe).toBeDefined();

        // Simulate unsubscribing after 5 seconds
        setTimeout(() => {
            subscriptionResponse.unsubscribe();
        }, 5000);
    });

    it('should create, list, and delete a channel', async () => {
        const channelName = 'test-create-channel-store';

        await client.create(channelName);
        const channels = await client.list(channelName);
        expect(channels.length).toBeGreaterThan(0);

        await client.delete(channelName);
        const updatedChannels = await client.list(channelName);
        expect(updatedChannels.length).toBe(0);
    });
});
