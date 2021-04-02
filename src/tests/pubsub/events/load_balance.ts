import { KubemqClient, Settings } from '../../../../old/classes';
import {
  EventReceive,
  Event,
  EventsSubscriptionRequest,
} from '../../../../old/classes';
import { Utils } from '../../../utils';
function main() {
  const senderSettings = new Settings('localhost:50000').setClientId(
    'sender-client-id',
  );
  const receiverSettingsA = new Settings('localhost:50000').setClientId(
    'receiver-client-id-a',
  );
  const receiverSettingsB = new Settings('localhost:50000').setClientId(
    'receiver-client-id-b',
  );
  const sender = new KubemqClient(senderSettings);

  const receiverA = new KubemqClient(receiverSettingsA);
  const receiveAHandler = function (event: EventReceive) {
    console.log('subscriberA', event);
  };
  const errorAHandler = function (e) {
    console.error('subscriberA', e);
  };
  const stateAHandler = function (state) {
    console.log('subscriberA', state);
  };

  const subscriberA = receiverA.subscribeToEvents(
    new EventsSubscriptionRequest('events.single', 'group1'),
    receiveAHandler,
    errorAHandler,
    stateAHandler,
  );

  const receiverB = new KubemqClient(receiverSettingsB);
  const receiveBHandler = function (event: EventReceive) {
    console.log('subscriberB', event);
  };
  const errorBHandler = function (e) {
    console.error('subscriberB', e);
  };
  const stateBHandler = function (state) {
    console.log('subscriberB', state);
  };

  const subscriberB = receiverB.subscribeToEvents(
    new EventsSubscriptionRequest('events.single', 'group1'),
    receiveBHandler,
    errorBHandler,
    stateBHandler,
  );
  setTimeout(() => {
    for (let i = 0; i < 10; i++) {
      let event = new Event()
        .setId(Utils.uuid())
        .setClientId('pub-sub-single-sender')
        .setChannel('events.single')
        .setBody(Utils.stringToBytes('event body'))
        .setMetadata('some-metadata');
      sender
        .sendEvent(event)
        .then((value) => console.log(value))
        .catch((reason) => console.log(reason));
    }
  }, 1000);
  setTimeout(() => {
    console.log('subscriberA', subscriberA.state);
    console.log('subscriberB', subscriberB.state);
  }, 5000);
}

main();
