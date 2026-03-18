import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      schemas: path.resolve(__dirname, '../schemas/src'),
      utils: path.resolve(__dirname, '../utils/src'),
    },
  },
});
