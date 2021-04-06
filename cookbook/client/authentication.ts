import { Config, QueuesClient, Utils } from '../../src';
const authToken = `eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9.eyJleHAiOjgzNDUzOTQxODV9.l6WdainvCQ8EJ9CFrH7eLBKlZEj69pBpq4T7OXr-NvT_yKWCaq5s3KC1sJrKquyDZvMNKQuGtW3TY8i803kg4V8TsWmmrTAJ5XiTXMg--qMnmmvTu2V1uHd1EaHZXSxHtx58tFtB5v10mRw74qJ18uiROT04YZ0sHKV4ZZG4ZHpvcHrTmZ1mwG-5i2hFol2dR7uad4umkDvFaPlzl4wq-y5-rMBYr8zS-IevWLaL794jxLgjrzV2stQWmbcb5Krrgo0GFS_OjGbt2qjYZ9spPYe6lz6Rktsw9NzbJEYSQnps2Yjemzw-D1o6eY9iPMXnIg3LN4swuxdcXwxz1rRMIg`;
async function main() {
  const opts: Config = {
    address: 'localhost:50000',
    authToken: authToken,
    clientId: Utils.uuid(),
  };
  const queuesClient = new QueuesClient(opts);
  await queuesClient
    .send({
      channel: 'queues.single',
      body: Utils.stringToBytes('queue message'),
    })
    .then((result) => console.log(result))
    .catch((reason) => console.error(reason));

  await queuesClient
    .pull({ channel: 'queues.single', maxNumberOfMessages: 1, waitTimeout: 5 })
    .then((response) => {
      response.messages.forEach((msg) => {
        console.log(msg);
      });
    })
    .catch((reason) => {
      console.error(reason);
    });
}

main();
