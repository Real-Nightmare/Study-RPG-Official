import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5189,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('katex')) return 'katex';
            if (id.includes('recharts') || id.includes('d3-')) return 'charts';
            if (id.includes('@radix-ui')) return 'radix';
            if (id.includes('react-markdown') || id.includes('remark-') || id.includes('rehype-') || id.includes('micromark')) return 'markdown';
            if (id.includes('framer-motion')) return 'motion';
            if (id.includes('react-router')) return 'router';
            if (id.includes('@tanstack') || id.includes('axios') || id.includes('zustand') || id.includes('socket.io-client')) return 'data';
            if (id.includes('react') || id.includes('scheduler') || id.includes('react-dom')) return 'react-vendor';
            return 'vendor';
          }
        },
      },
    },
  },
});
