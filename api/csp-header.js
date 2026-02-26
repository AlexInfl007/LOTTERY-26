export default function handler(req, res) {
  // Set the Content-Security-Policy header
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https:; connect-src 'self' https://polygon-rpc.com https://api.polygonscan.com https://rpc-mumbai.maticvigil.com https://api.etherscan.io; frame-src 'self' https://www.youtube.com; object-src 'none';"
  );

  // Continue with your API logic here
  res.status(200).json({ success: true });
}