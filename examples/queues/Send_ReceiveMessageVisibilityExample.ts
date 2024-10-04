import { Config, QueuesClient, QueuesPollRequest, Utils } from 'kubemq-js';

async function main() {
  const opts: Config = {
    address: 'localhost:50000',
    clientId: 'kubeMQClientId-ts',
  };
  const queuesClient = new QueuesClient(opts);

  // Receive with message visibility
  async function receiveWithVisibility(visibilitySeconds: number) {
    console.log(
      '\n============================== Receive with Visibility =============================\n',
    );
    try {
      const pollRequest = new QueuesPollRequest({
        channel: 'visibility_channel',
        pollMaxMessages: 1,
        pollWaitTimeoutInSeconds: 10,
        visibilitySeconds: visibilitySeconds,
        autoAckMessages: false,
      });

      const pollResponse = await queuesClient.receiveQueuesMessages(
        pollRequest,
      );
      console.log('Received Message Response:', pollResponse);

      if (pollResponse.isError) {
        console.log('Error: ' + pollResponse.error);
      } else {
        for (const msg of pollResponse.messages) {
          console.log(
            `Message ID: ${msg.id}, Message Body: ${Utils.bytesToString(
              msg.body,
            )}`,
          );
          try {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            msg.ack();
            console.log('Acknowledged message');
          } catch (err) {
            console.error('Error acknowledging message:', err);
          }
        }
      }
    } catch (error) {
      console.error('Failed to receive queue messages:', error);
    }
  }

  // Test visibility expiration
  async function receiveWithVisibilityExpired() {
    console.log(
      '\n============================== Receive with Visibility Expired =============================\n',
    );
    await receiveWithVisibility(2);
  }

  // Test visibility extension
  async function receiveWithVisibilityExtension() {
    console.log(
      '\n============================== Receive with Visibility Extension =============================\n',
    );
    try {
      const pollRequest = new QueuesPollRequest({
        channel: 'visibility_channel',
        pollMaxMessages: 1,
        pollWaitTimeoutInSeconds: 10,
        visibilitySeconds: 3,
        autoAckMessages: false,
      });

      const pollResponse = await queuesClient.receiveQueuesMessages(
        pollRequest,
      );
      console.log('Received Message Response:', pollResponse);

      if (pollResponse.isError) {
        console.log('Error: ' + pollResponse.error);
      } else {
        for (const msg of pollResponse.messages) {
          console.log(
            `Message ID: ${msg.id}, Message Body: ${Utils.bytesToString(
              msg.body,
            )}`,
          );
          try {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            msg.extendVisibilityTimer(3);
            await new Promise((resolve) => setTimeout(resolve, 2000));
            msg.ack();
            console.log('Acknowledged message after extending visibility');
          } catch (err) {
            console.error('Error during visibility extension:', err);
          }
        }
      }
    } catch (error) {
      console.error('Failed to receive queue messages:', error);
    }
  }

  await receiveWithVisibilityExpired();
  await receiveWithVisibilityExtension();
}

main();
