import { defineConfig } from 'tsup';

// src/index.ts --format cjs,esm --dts --clean
export default defineConfig({
  entry: ['./src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  bundle: false,
  esbuildOptions(options) {
    options.bundle = true;
    options.platform = 'node';
    options.target = 'node16';
  },
});
