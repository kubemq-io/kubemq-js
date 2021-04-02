import { Client } from '../../client';
import { Config } from '../../config';

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
