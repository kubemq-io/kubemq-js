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
  const receiverSettings = new Settings('localhost:50000').setClientId(
    'receiver-client-id',
  );
  const sender = new KubemqClient(senderSettings);
  const receiver = new KubemqClient(receiverSettings);

  const receiveHandler = function (event: EventReceive) {
    console.log(event);
  };
  const errorHandler = function (e) {
    console.error(e);
  };
  const stateHandler = function (state) {
    console.log(state);
  };
  const subscriber = receiver.subscribeToEvents(
    new EventsSubscriptionRequest('events.single', ''),
    receiveHandler,
    errorHandler,
    stateHandler,
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
    receiver.close();
    console.log(subscriber.state);
  }, 500000);
}

main();
