import { PubsubClient } from '../../src/pubsub/PubsubClient';
import { Config } from '../../src/client/config';
import * as grpc from '@grpc/grpc-js';
import { PubSubChannel } from '../../src/common/channel_stats';
import { EventsMessage, EventsStoreMessage } from '../../src/pubsub/eventTypes';

describe('EventsClient Integration Tests', () => {
    let client: PubsubClient;
    const config: Config = { /* Your Config Here */ };

    beforeAll(() => {
        client = new PubsubClient(config);
    });

    it('should send an event successfully', async () => {
        const msg: EventsMessage = {
            id: 'test-event-id',
            clientId: 'test-client-id',
            channel: 'test-channel',
            body: Buffer.from('test-body'),
            metadata: 'test-metadata',
            tags: new Map([['key1', 'value1']]),
        };

        const result = await client.sendEventsMessage(msg);
        expect(result.sent).toBe(true);
        expect(result.id).toBe(msg.id);
    });


    it('should subscribe to events successfully', async () => {
        const subscriptionResponse = await client.subscribeToEvents(
            { channel: 'test-channel' },
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
        const channelName = 'test-create-channel';

        await client.createEventsChannel(channelName);
        const channels = await client.listEventsChannels(channelName);
        expect(channels.length).toBeGreaterThan(0);

        await client.deleteEventsChannel(channelName);
        const updatedChannels = await client.listEventsChannels(channelName);
        expect(updatedChannels.length).toBe(0);
    });
});
