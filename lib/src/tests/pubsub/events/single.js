'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const classes_1 = require('../../../../old/classes');
const classes_2 = require('../../../../old/classes');
const utils_1 = require('../../../utils');
function main() {
  const senderSettings = new classes_1.Settings('localhost:50000').setClientId(
    'sender-client-id',
  );
  const receiverSettings = new classes_1.Settings(
    'localhost:50000',
  ).setClientId('receiver-client-id');
  const sender = new classes_1.KubemqClient(senderSettings);
  const receiver = new classes_1.KubemqClient(receiverSettings);
  const receiveHandler = function (event) {
    console.log(event);
  };
  const errorHandler = function (e) {
    console.error(e);
  };
  const stateHandler = function (state) {
    console.log(state);
  };
  const subscriber = receiver.subscribeToEvents(
    new classes_2.EventsSubscriptionRequest('events.single', ''),
    receiveHandler,
    errorHandler,
    stateHandler,
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
    receiver.close();
    console.log(subscriber.state);
  }, 500000);
}
main();
//# sourceMappingURL=single.js.map
