import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react()
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
      // WebSocket proxy for price updates
      '/ws': {
        target: 'ws://localhost:3002',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom'],
          'farcaster': ['@farcaster/miniapp-sdk'],
        },
      },
      onwarn(warning, warn) {
        // Suppress PURE annotation warnings from dependencies
        if (warning.code === 'INVALID_ANNOTATION' && warning.message.includes('PURE')) {
          return;
        }
        warn(warning);
      },
    },
  },
})
