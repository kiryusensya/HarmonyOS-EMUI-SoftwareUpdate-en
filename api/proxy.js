export default async function handler(req, res) {
  const GAS_URL = process.env.GAS_API_URL;

  if (!GAS_URL) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // フロントエンドからのデータを受け取る
  const params = new URLSearchParams({
    ...(req.query || {}),
    ...(req.body || {})
  });

  const targetUrl = `${GAS_URL}?${params.toString()}`;

  try {
    // 元のコードと同じ「GETリクエスト」でGASに問い合わせ
    const response = await fetch(targetUrl);
    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Authentication failed' });
  }
}
