export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ status: '0', message: 'Method not allowed', result: 'Use GET' });
    return;
  }

  try {
    const query = req.query || {};
    const url = new URL('https://api.polygonscan.com/api');

    Object.entries(query).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((item) => url.searchParams.append(key, String(item)));
      } else if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });

    const response = await fetch(url.toString(), { method: 'GET' });
    const text = await response.text();

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=30');
    res.status(response.status).send(text);
  } catch (error) {
    res.status(500).json({
      status: '0',
      message: 'Proxy error',
      result: error?.message || 'Unknown proxy error'
    });
  }
}
