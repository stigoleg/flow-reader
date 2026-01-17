/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import manifest from './src/manifest.json';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      input: {
        reader: resolve(__dirname, 'src/reader/index.html'),
        popup: resolve(__dirname, 'src/popup/index.html'),
        options: resolve(__dirname, 'src/options/index.html'),
        archive: resolve(__dirname, 'src/archive/index.html'),
      },
      output: {
        manualChunks: (id) => {
          // Split large vendor libraries into separate chunks
          if (id.includes('node_modules')) {
            if (id.includes('pdfjs-dist')) {
              return 'pdf';
            }
            // mammoth and all its dependencies (for DOCX parsing)
            if (id.includes('mammoth') || 
                id.includes('xmldom') || 
                id.includes('base64-js') ||
                id.includes('bluebird') ||
                id.includes('dingbat-to-unicode') ||
                id.includes('jszip') ||
                id.includes('lop') ||
                id.includes('underscore') ||
                id.includes('xmlbuilder')) {
              return 'docx';
            }
            // fflate for compression (used by epub/mobi handlers)
            if (id.includes('fflate')) {
              return 'compression';
            }
            if (id.includes('react-dom')) {
              return 'react-dom';
            }
            if (id.includes('react')) {
              return 'react';
            }
            if (id.includes('zustand')) {
              return 'zustand';
            }
            // Group remaining node_modules into vendor chunk
            return 'vendor';
          }
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});
