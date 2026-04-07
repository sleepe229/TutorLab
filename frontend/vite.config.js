import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => ({
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
    // Stub out Node-only 'websocket' package required by stompjs (browsers use native WebSocket)
    alias: {
      events:    'events',
      websocket: path.resolve(__dirname, 'src/stubs/websocket-browser.js'),
    },
  },
  optimizeDeps: {
    include: ['simple-peer', 'events', 'sockjs-client', 'stompjs'],
  },
  define: {
    global: 'globalThis',
    'process.env.NODE_ENV': JSON.stringify(mode),
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
}));