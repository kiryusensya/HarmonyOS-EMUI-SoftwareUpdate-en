import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// 1. レートリミットの準備
const redis = Redis.fromEnv();

// もしRedisの接続設定が環境変数で自動解決できない場合は、明示的に書く必要がありますが、
// 通常は UPSTASH_REDIS_REST_URL と UPSTASH_REDIS_REST_TOKEN を環境変数に設定すれば fromEnv() で動きます。

const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(5, "60 s"), // 60秒に5回まで
});

export default async function handler(req, res) {
  // -------------------------------------------------------
  // 1. セキュリティチェック（門番）
  // -------------------------------------------------------
  try {
    // Vercelの場合、IP取得は req.headers['x-forwarded-for'] が確実です
    const identifier = req.headers['x-forwarded-for'] 
      ? req.headers['x-forwarded-for'].split(',')[0] 
      : 'ip';
      
    const { success } = await ratelimit.limit(identifier);

    if (!success) {
      return res.status(429).json({ 
        error: 'Too Many Requests',
        message: '試行回数が多すぎます。しばらく待ってから再試行してください。' 
      });
    }
  } catch (err) {
    console.error("Rate limit error:", err);
    // Redisエラー時はユーザーをブロックせず通す（フェイルオープン）
  }

  // -------------------------------------------------------
  // 2. GASへのプロキシ処理
  // -------------------------------------------------------
  const GAS_URL = process.env.GAS_API_URL;

  if (!GAS_URL) {
    return res.status(500).json({ error: 'Server configuration error: GAS_URL not set' });
  }

  // URLパラメータの構築
  // req.query と req.body をマージ
  const params = new URLSearchParams({
    ...(req.query || {}),
    ...(req.body || {})
  });

  // ★修正箇所: バッククォート (`) を使用
  const targetUrl = `${GAS_URL}?${params.toString()}`;

  try {
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
