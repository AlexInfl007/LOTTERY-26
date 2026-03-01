export default function handler(req, res) {
  // Enhanced CSP configuration for Web3 applications
  // Includes support for various wallet providers and WebAssembly operations
  const cspHeader = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.googleapis.com https://*.gstatic.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' https://fonts.gstatic.com https://*.gstatic.com",
    "connect-src 'self' https: wss:",
    "frame-src 'self' https://www.youtube.com",
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