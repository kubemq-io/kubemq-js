# kubemq-node-js

generate ts proto 
1. get protoc
2. install grpc_tools_node_protoc
   grpc_tools_node_protoc --js_out=import_style=commonjs,binary:./ --grpc_out=generate_package_definition:./ kubemq.proto