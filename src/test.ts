const PROTO_PATH = __dirname + '/protos/kubemq.proto';
const protoLoader = require('@grpc/proto-loader');
const grpc = require('@grpc/grpc-js');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const kubemq = grpc.loadPackageDefinition(packageDefinition).kubemq;
const client = new kubemq.Kubemq(
  'localhost:50000',
  grpc.credentials.createInsecure(),
);
const req=kubemq.
client.ping(, (e, res) => {
  if (e) {
    console.error(e);
    return;
  }
  console.log(res);
});
