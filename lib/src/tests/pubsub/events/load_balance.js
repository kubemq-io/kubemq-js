'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const classes_1 = require('../../../../old/classes');
const classes_2 = require('../../../../old/classes');
const utils_1 = require('../../../utils');
function main() {
  const senderSettings = new classes_1.Settings('localhost:50000').setClientId(
    'sender-client-id',
  );
  const receiverSettingsA = new classes_1.Settings(
    'localhost:50000',
  ).setClientId('receiver-client-id-a');
  const receiverSettingsB = new classes_1.Settings(
    'localhost:50000',
  ).setClientId('receiver-client-id-b');
  const sender = new classes_1.KubemqClient(senderSettings);
  const receiverA = new classes_1.KubemqClient(receiverSettingsA);
  const receiveAHandler = function (event) {
    console.log('subscriberA', event);
  };
  const errorAHandler = function (e) {
    console.error('subscriberA', e);
  };
  const stateAHandler = function (state) {
    console.log('subscriberA', state);
  };
  const subscriberA = receiverA.subscribeToEvents(
    new classes_2.EventsSubscriptionRequest('events.single', 'group1'),
    receiveAHandler,
    errorAHandler,
    stateAHandler,
  );
  const receiverB = new classes_1.KubemqClient(receiverSettingsB);
  const receiveBHandler = function (event) {
    console.log('subscriberB', event);
  };
  const errorBHandler = function (e) {
    console.error('subscriberB', e);
  };
  const stateBHandler = function (state) {
    console.log('subscriberB', state);
  };
  const subscriberB = receiverB.subscribeToEvents(
    new classes_2.EventsSubscriptionRequest('events.single', 'group1'),
    receiveBHandler,
    errorBHandler,
    stateBHandler,
  );
  setTimeout(() => {
    for (let i = 0; i < 10; i++) {
      let event = new classes_2.Event()
        .setId(utils_1.Utils.uuid())
        .setClientId('pub-sub-single-sender')
        .setChannel('events.single')
        .setBody(utils_1.Utils.stringToBytes('event body'))
        .setMetadata('some-getMetadata');
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
//# sourceMappingURL=load_balance.js.map
