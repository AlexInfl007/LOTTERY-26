export default function handler(req, res) {
  // Enhanced CSP configuration for Web3 applications
  // Includes support for various wallet providers and WebAssembly operations
  const cspHeader = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' chrome-extension: moz-extension: https://polygonscan.com https://api.polygonscan.com https://polygon-rpc.com https://*.walletconnect.com https://*.walletconnect.org https://*.coinbase.com https://*.metamask.io https://*.infura.io https://*.alchemyapi.io https://*.alchemy.com https://*.chain.link https://*.polygon-rpc.com https://*.matic.network https://*.binance.org https://*.okex.org https://*.trustwallet.com https://*.phantom.app https://*.bitkeep.com https://*.rabby.io https://*.okx.com https://*.tokenpocket.pro https://*.brave.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.googleapis.com https://*.gstatic.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' https://fonts.gstatic.com https://*.gstatic.com",
    "connect-src 'self' https: wss: ws: http://localhost:* https://polygonscan.com https://api.polygonscan.com https://polygon-rpc.com https://rpc-mumbai.maticvigil.com https://api.etherscan.io https://*.walletconnect.com https://*.walletconnect.org https://*.infura.io https://*.alchemyapi.io https://*.alchemy.com https://*.chain.link https://*.polygon-rpc.com https://*.matic.network https://*.binance.org https://*.okex.org https://*.trustwallet.com https://*.phantom.app https://*.bitkeep.com https://*.rabby.io https://*.okx.com https://*.tokenpocket.pro https://*.brave.com",
    "frame-src 'self' https://www.youtube.com https://*.walletconnect.com https://*.walletconnect.org https://*.coinbase.com https://*.metamask.io https://*.trustwallet.com https://*.phantom.app https://*.bitkeep.com https://*.rabby.io https://*.okx.com https://*.tokenpocket.pro https://*.brave.com",
    "object-src 'none'",
    "base-uri 'self'",
    "manifest-src 'self'",
    "media-src 'self' https:",
    "worker-src 'self' blob:",
    "frame-ancestors 'self'"
  ].join('; ');

  res.setHeader('Content-Security-Policy', cspHeader);

  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Continue with your API logic here
  res.status(200).json({ success: true });
}