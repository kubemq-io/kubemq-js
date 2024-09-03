import { PubsubClient } from '../../src/pubsub/PubsubClient';
import { Config } from '../../src/client/config';
import { EventsStoreMessage, EventStoreType } from '../../src/pubsub/eventTypes';

describe('EventsStoreClient Integration Tests', () => {
    let client: PubsubClient;
    const config: Config = { /* Your Config Here */ };

    beforeAll(() => {
        client = new PubsubClient(config);
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

        const result = await client.sendEventStoreMessage(msg);
        expect(result.sent).toBe(true);
        expect(result.id).toBe(msg.id);
    });

    it('should subscribe to events store successfully', async () => {
        const subscriptionResponse = await client.subscribeToEventsStore(
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

        await client.createEventsStoreChannel(channelName);
        const channels = await client.listEventsStoreChannels(channelName);
        expect(channels.length).toBeGreaterThan(0);

        await client.deleteEventsStoreChannel(channelName);
        const updatedChannels = await client.listEventsStoreChannels(channelName);
        expect(updatedChannels.length).toBe(0);
    });
});
