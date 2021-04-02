import { Options } from '../options';
import { Client } from '../../client';

function main() {
  const opts: Options = {
    address: 'localhost:50000',
  };
  const client = new Client(opts);
  client
    .ping()
    .then((value) => console.log(value))
    .catch((reason) => console.log(reason));
}

main();
