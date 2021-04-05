import { Utils, EventsClient, Config } from '../../../src';

function main() {
  const opts: Config = {
    address: 'localhost:50000',
    clientId: Utils.uuid(),
  };
  const eventsClient = new EventsClient(opts);

  const subRequest = {
    channel: 'events.single',
  };

  eventsClient
    .subscribe(subRequest, (err, msg) => {
      if (err) {
        console.error(err);
        return;
      }
      if (msg) {
        console.log(msg);
      }
    })
    .then((response) => {
      console.log('started');
      response.onStatus.on((status) => console.log('status', status));
    })
    .catch((reason) => {
      console.log(reason);
    });
  // eventsClient
  //   .subscribe(subRequest, (err, msg) => {
  //     if (err) {
  //       console.error(err);
  //       return;
  //     }
  //     if (msg) {
  //       console.log(msg);
  //     }
  //   })
  //   .catch((reason) => {
  //     console.log(reason);
  //   });
}

//
// setTimeout(async () => {
//   let isError: boolean = false;
//   for (let i = 0; i < 10; i++) {
//     await eventsClient
//       .send({ channel: 'events.single', body: Utils.stringToBytes('data') })
//         isError = true;
//       .catch((reason) => {
//         console.error(reason);
//       });
//     if (isError) {
//       break;
//     }
//   }
// }, 2000);
//
// setTimeout(() => {
//   eventsClient.close();
// }, 4000);
main();
