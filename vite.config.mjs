import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    headers: {
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob: data: 'strict-dynamic' 'nonce-*'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.googleapis.com https://*.gstatic.com; img-src 'self' data: blob: https:; font-src 'self' https://fonts.gstatic.com https://*.gstatic.com; connect-src 'self' https: wss:; frame-src 'self' https://www.youtube.com; object-src 'none'; base-uri 'self'; manifest-src 'self'; media-src 'self' https:; worker-src 'self' blob:;"
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          let extType = assetInfo.name.split('.').at(1);
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
            return 'images/[name].[hash][extname]';
          }
          return '[name].[hash][extname]';
        }
      }
    }
  }
})
