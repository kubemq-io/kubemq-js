"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const kubets_1 = require("kubets");
const kubets_2 = require("kubets");
const kubets_3 = require("kubets");
const kubets_4 = require("kubets");
const classes_1 = require("kubets/compiled/classes");
const receiver = new kubets_1.GeneralReceiver({
    host: '127.0.0.1',
    port: 50000,
    channel: 'testing_Command_channel',
    client: 'hello-world-receiver',
    type: kubets_4.ReceiverType.Query,
    defaultTimeout: 50000
});
const publisher = new kubets_3.Publisher({
    host: classes_1.Config.get('KubeMQServerAddress', '127.0.0.1'),
    port: classes_1.Config.get('KubeMQServerPort', 50000),
    channel: 'testing_Command_channel',
    client: 'hello-world-pub',
    type: kubets_4.SubscribeType.Events,
    defaultTimeout: 50000
});
const subscriber = new kubets_3.Subscriber({
    host: classes_1.Config.get('KubeMQServerAddress', '127.0.0.1'),
    port: classes_1.Config.get('KubeMQServerPort', 50000),
    channel: 'testing_Command_channel',
    client: 'hello-world-sub',
    type: kubets_4.SubscribeType.Events,
    defaultTimeout: 50000
});
const sender = new kubets_1.GeneralSender({
    host: classes_1.Config.get('KubeMQServerAddress', '127.0.0.1'),
    port: classes_1.Config.get('KubeMQServerPort', 50000),
    channel: 'testing_Command_channel',
    client: 'hello-world-sender',
    type: kubets_4.ReceiverType.Query,
    defaultTimeout: 50000
});
function generate_random_data1(size) {
    let chars = 'abcdefghijklmnopqrstuvwxyz'.split('');
    let len = chars.length;
    let random_data = [];
    while (size--) {
        random_data.push(chars[Math.random() * len | 0]);
    }
    return random_data.join('');
}
const bigData = Buffer.from(generate_random_data1(32));
subscriber.subscribe(console.log, console.error);
setTimeout(() => {
    console.log('yes');
    const event2 = new kubets_2.Event();
    event2.setBody(Buffer.from('beans'));
    publisher.send(event2);
}, 2000);
let request = new kubets_2.Request();
request.setBody(Buffer.from("request data"));
request.setTimeout(10000);
const event = new kubets_2.Event();
event.setBody(Buffer.from("event data"));
event.setClientid('gateway');
event.setChannel('test');
// console.log('moving up and down, side to side like a rollercoaster.');
receiver.subscribe((cmd) => {
    console.log('Receiver got a hit for a message!');
    let body = cmd.getBody();
    // if (typeof body !== 'string') body = new TextDecoder().decode(body);
    console.log(body);
    const res = new kubets_2.Response();
    res.setBody(bigData);
    receiver.ack(cmd, res).then((snd) => {
        console.log('Receiver has acknowledged request.!', snd);
    }).catch(console.log);
}, (e) => {
    console.log('sub error');
    console.log(e);
});
setTimeout(() => {
    console.log('We are about to send a message');
    sender.send(request).then((res) => {
        console.log('Giver has sent message successfully sent and it was acknowledged by the receiver.');
        console.log(new TextDecoder().decode(res.getBody()).substr(0, 20));
        if (res.getError()) {
            console.log('Response error:' + res.getError());
            return;
        }
        // console.log(res)
        // console.log('Response Received: ' + res.RequestID + ' ExecutedAt: ' + res.Timestamp);
    }).catch((e) => {
        console.log('pub error');
        console.log(e);
    });
}, 2000);
//# sourceMappingURL=main.js.map