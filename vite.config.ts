import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // The lazily loaded chart chunk is mostly ECharts core (about 570 kB, 190 kB gzipped),
    // already trimmed to the parts in use. The limit sits just above it so growth still warns.
    chunkSizeWarningLimit: 600,
  },
  test: {
    include: ['src/**/*.test.ts', 'eslint/**/*.test.ts'],
    environment: 'node',
  },
});
