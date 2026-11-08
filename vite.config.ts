import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // The lazily loaded results chunk is mostly ECharts core with the line, bar and boxplot
    // charts (about 625 kB, 210 kB gzipped). The limit sits just above it so growth still warns.
    chunkSizeWarningLimit: 700,
  },
  test: {
    include: ['src/**/*.test.ts', 'eslint/**/*.test.ts'],
    environment: 'node',
  },
});
