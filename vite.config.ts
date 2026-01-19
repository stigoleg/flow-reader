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
          // Only split out large, self-contained vendor libraries
          // Don't try to split react/zustand/vendor as this causes circular dependencies
          if (id.includes('node_modules')) {
            // PDF.js - large and only used by reader for PDFs
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
            // recharts and its dependencies (only used in archive stats modal)
            if (id.includes('recharts') || 
                id.includes('victory-vendor') ||
                id.includes('d3-') ||
                id.includes('internmap') ||
                id.includes('delaunator') ||
                id.includes('robust-predicates')) {
              return 'charts';
            }
            // Let Rollup handle everything else automatically
            // This avoids circular dependency issues
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
