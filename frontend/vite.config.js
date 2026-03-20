import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    // Polyfill Node.js built-ins used by simple-peer's deps (readable-stream → events)
    alias: {
      events: 'events',
    },
  },
  optimizeDeps: {
    include: ['simple-peer', 'events'],
  },
  define: {
    global: 'globalThis',
  },
  build: {
    commonjsOptions: {
      include: [/simple-peer/, /node_modules/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        manualChunks: {
          // WebRTC + live lesson deps — only needed on /live/* routes
          webrtc: ['simple-peer', 'events'],
          // STOMP/SockJS — only needed in live lesson
          stomp: ['sockjs-client', 'stompjs'],
          // React core — always needed, separate for better caching
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});