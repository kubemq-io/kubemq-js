import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
  splitting: false,
  treeshake: true,
  target: 'node20',
  platform: 'node',
  external: ['@grpc/grpc-js', '@grpc/proto-loader', 'google-protobuf', '@opentelemetry/api'],
  noExternal: [],
  outExtension({ format }) {
    return {
      js: format === 'cjs' ? '.cjs' : '.js',
    };
  },
  esbuildOptions(options) {
    options.conditions = ['node'];
  },
});
