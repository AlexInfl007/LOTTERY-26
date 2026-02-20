export default function handler(req, res) {
  // Set the Content-Security-Policy header
  res.setHeader(
    'Content-Security-Policy',
    "script-src 'self' 'unsafe-eval'; object-src 'none';"
  );

  // Continue with your API logic here
  res.status(200).json({ success: true });
}