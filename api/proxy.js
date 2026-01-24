export default async function handler(req, res) {
  // -------------------------------------------------------
  // GASへのプロキシ処理
  // -------------------------------------------------------
  const GAS_URL = process.env.GAS_API_URL;

  if (!GAS_URL) {
    return res.status(500).json({ error: 'Server configuration error: GAS_URL not set' });
  }

  // URLパラメータの構築
  // フロントエンドからの GET(query) と POST(body) をまとめて GAS に送るパラメータにします
  const params = new URLSearchParams({
    ...(req.query || {}),
    ...(req.body || {})
  });

  // バッククォート (`) を使用してURLを作成
  const targetUrl = `${GAS_URL}?${params.toString()}`;

  try {
    // GASへリクエスト転送
    const response = await fetch(targetUrl);
    
    if (!response.ok) {
        throw new Error(`GAS responded with ${response.status}`);
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Authentication failed or GAS error' });
  }
}
