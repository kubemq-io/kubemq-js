import { Client } from '../../../src/client';
import { Config } from '../../../src/config';

function main() {
  const opts: Config = {
    address: 'localhost:50000',
  };
  const client = new Client(opts);
  client
    .ping()
    .then((value) => console.log(value))
    .catch((reason) => console.log(reason));
}

main();
