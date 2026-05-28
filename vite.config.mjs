import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    headers: {
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://polygonscan.com https://api.polygonscan.com https://*.walletconnect.com https://*.walletconnect.org https://verify.walletconnect.com https://registry.walletconnect.com https://explorer.walletconnect.com https://*.coinbase.com https://*.metamask.io https://*.infura.io https://*.alchemyapi.io https://*.alchemy.com https://*.chain.link https://*.binance.org https://*.okex.org https://*.trustwallet.com https://*.phantom.app https://*.bitkeep.com https://*.rabby.io https://*.okx.com https://*.tokenpocket.pro https://*.brave.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.googleapis.com https://*.gstatic.com; img-src 'self' data: blob: https:; font-src 'self' https://fonts.gstatic.com https://*.gstatic.com; connect-src 'self' https: wss: ws: http://localhost:* https://polygonscan.com https://api.polygonscan.com https://api.etherscan.io https://*.walletconnect.com https://*.walletconnect.org https://verify.walletconnect.com https://registry.walletconnect.com https://explorer.walletconnect.com https://*.infura.io https://*.alchemyapi.io https://*.alchemy.com https://*.chain.link https://*.binance.org https://*.okex.org https://*.trustwallet.com https://*.phantom.app https://*.bitkeep.com https://*.rabby.io https://*.okx.com https://*.tokenpocket.pro https://*.brave.com; frame-src 'self' https://www.youtube.com https://*.walletconnect.com https://*.walletconnect.org https://verify.walletconnect.com https://registry.walletconnect.com https://explorer.walletconnect.com https://*.coinbase.com https://*.metamask.io https://*.trustwallet.com https://*.phantom.app https://*.bitkeep.com https://*.rabby.io https://*.okx.com https://*.tokenpocket.pro https://*.brave.com; object-src 'none'; base-uri 'self'; manifest-src 'self'; media-src 'self' https:; worker-src 'self' blob:;"
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
