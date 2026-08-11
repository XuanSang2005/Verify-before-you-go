import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^react-native$/,
        replacement: fileURLToPath(new URL('../../node_modules/react-native-web/dist/index.js', import.meta.url)),
      },
      {
        find: '@',
        replacement: fileURLToPath(new URL('./src', import.meta.url)),
      },
    ],
  },
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        pretendToBeVisual: true,
      },
    },
    include: ['src/**/*.render.test.tsx'],
  },
});
