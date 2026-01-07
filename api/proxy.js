import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

// テスト設定: 10秒間に2回まで
const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(2, "10 s"),
});

export default async function handler(req, res) {
  const identifier = req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0] : 'ip';
  
  // 制限チェック
  const { success } = await ratelimit.limit(identifier);

  if (!success) {
    return res.status(429).json({ 
      error: 'Too Many Requests',
      message: '連打制限がかかりました。少し待ってください。'
    });
  }

  if (req.method === 'POST') {
    try {
      const gasUrl = process.env.GAS_API_URL;
      
      // 【修正点】データが文字かオブジェクトかを確認して、正しく変換する
      const payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

      const response = await fetch(gasUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json', // 常にJSONとして送る
        },
        body: payload
      });

      const data = await response.json();
      return res.status(200).json(data);

    } catch (error) {
      return res.status(500).json({ error: 'Server Error' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
