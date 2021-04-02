import {GeneralReceiver, GeneralSender} from "./index";

import {Event, Request, Response} from "./index";
import {Publisher, Subscriber} from "./index";
import {ReceiverType, SubscribeType} from "./index";
import {Config} from "./classes";
const receiver = new GeneralReceiver({
  host: '127.0.0.1',
  port: 50000,
  channel: 'testing_Command_channel',
  client: 'hello-world-receiver',
  type: ReceiverType.Query,
  defaultTimeout: 50000
});
const publisher = new Publisher({
  host: Config.get('KubeMQServerAddress', '127.0.0.1'),
  port: Config.get('KubeMQServerPort', 50000),
  channel: 'testing_Command_channel',
  client: 'hello-world-pub',
  type: SubscribeType.Events,
  defaultTimeout: 50000
});
const subscriber = new Subscriber({
  host: Config.get('KubeMQServerAddress', '127.0.0.1'),
  port: Config.get('KubeMQServerPort', 50000),
  channel: 'testing_Command_channel',
  client: 'hello-world-sub',
  type: SubscribeType.Events,
  defaultTimeout: 50000
});
const sender = new GeneralSender({
  host: Config.get('KubeMQServerAddress', '127.0.0.1'),
  port: Config.get('KubeMQServerPort', 50000),
  channel: 'testing_Command_channel',
  client: 'hello-world-sender',
  type: ReceiverType.Query,
  defaultTimeout: 50000
});

function generate_random_data1(size: number){
  let chars = 'abcdefghijklmnopqrstuvwxyz'.split('');
  let len = chars.length;
  let random_data = [];

  while (size--) {
    random_data.push(chars[Math.random()*len | 0]);
  }

  return random_data.join('');
}

const bigData = Buffer.from(generate_random_data1(32));

subscriber.subscribe(console.log, console.error);

setTimeout(() => {
  console.log('yes')
  const event2 = new Event();
  event2.setBody(Buffer.from('beans'))
  publisher.send(event2);
}, 2000);


let request = new Request();
request.setBody(Buffer.from("request data"));
request.setTimeout(10000);

const event = new Event();
event.setBody(Buffer.from("event data"));
event.setClientid('gateway');
event.setChannel('test');

// console.log('moving up and down, side to side like a rollercoaster.');
receiver.subscribe((cmd: Request) => {
  console.log('Receiver got a hit for a message!');
  let body = cmd.getBody();


  // if (typeof body !== 'string') body = new TextDecoder().decode(body);
   console.log(body);
  const res = new Response();
  res.setBody(bigData)

  receiver.ack(cmd, res).then((snd: any) => {
    console.log('Receiver has acknowledged request.!',snd)
  }).catch(console.log)
}, (e: any) => {
  console.log('sub error')
   console.log(e)
});

setTimeout(() => {
  console.log('We are about to send a message');
  sender.send(request).then((res: Response) => {
    console.log('Giver has sent message successfully sent and it was acknowledged by the receiver.')
    console.log(new TextDecoder().decode(<Uint8Array>res.getBody()).substr(0, 20))
    if (res.getError()) {
      console.log('Response error:' + res.getError());
      return;
    }
    // console.log(res)
    // console.log('Response Received: ' + res.RequestID + ' ExecutedAt: ' + res.Timestamp);
  }).catch((e: any) => {
    console.log('pub error')
    console.log(e)
  });
}, 2000);
