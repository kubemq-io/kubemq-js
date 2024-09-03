import { Config, Utils, CQClient } from '../../../src';

const opts: Config = {
  address: 'localhost:50000',
  clientId: Utils.uuid(),
  reconnectInterval: 1000,
};
const cqClient = new CQClient(opts);
async function deleteChannel(channel: string) {
  return cqClient.deleteQueriesChannel(channel);
}

async function main() {
  await deleteChannel('q2');
  // wait for receiver
}
main();
