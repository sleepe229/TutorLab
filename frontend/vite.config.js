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
    manifest: true,
    commonjsOptions: {
      include: [/simple-peer/, /node_modules/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        manualChunks: {
          // simple-peer only — only needed on /live/* routes (lazy-loaded)
          webrtc: ['simple-peer'],
          // STOMP/SockJS — only needed in StudentDashboard + live lesson (lazy-loaded)
          stomp: ['sockjs-client', 'stompjs'],
          // React core + shared Node polyfills — always needed
          vendor: ['react', 'react-dom', 'react-router-dom', 'events'],
        },
      },
    },
  },
});