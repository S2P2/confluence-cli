import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'bin/confluence': 'src/index.ts',
    index: 'src/cli.ts',
  },
  format: ['esm'],
  target: 'node18',
  outDir: 'dist',
  clean: true,
  dts: true,
  sourcemap: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
});
