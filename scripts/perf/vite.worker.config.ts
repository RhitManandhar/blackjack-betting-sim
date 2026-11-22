import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// Bundles the Node benchmark worker (scripts/perf/nodeWorker.ts) into one plain .mjs file,
// so worker threads can load it without a TypeScript loader.
export const NODE_WORKER_FILE = fileURLToPath(
  new URL('../../node_modules/.perf/nodeWorker.mjs', import.meta.url),
);

export default defineConfig({
  logLevel: 'warn',
  publicDir: false,
  build: {
    ssr: fileURLToPath(new URL('./nodeWorker.ts', import.meta.url)),
    outDir: fileURLToPath(new URL('../../node_modules/.perf', import.meta.url)),
    emptyOutDir: true,
    target: 'node24',
    minify: false,
    rollupOptions: { output: { entryFileNames: 'nodeWorker.mjs', format: 'es' } },
  },
  ssr: { noExternal: true },
});
