import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { 'bin/confluence': 'src/index.ts' },
    format: ['esm'],
    target: 'node18',
    outDir: 'dist',
    clean: true,
    sourcemap: true,
    banner: { js: '#!/usr/bin/env node' },
  },
  {
    entry: { index: 'src/cli.ts' },
    format: ['esm'],
    target: 'node18',
    outDir: 'dist',
    dts: true,
    sourcemap: true,
  },
]);
