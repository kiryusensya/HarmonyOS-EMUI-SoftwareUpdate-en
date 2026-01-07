import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

// レートリミット設定: 10秒間に2回まで
const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(2, "10 s"),
});

export default async function handler(req, res) {
  const identifier = req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0] : 'ip';
  
  // 1. 制限チェック
  const { success } = await ratelimit.limit(identifier);
  if (!success) {
    return res.status(429).json({ error: 'Too Many Requests', message: '連打制限がかかりました。' });
  }

  if (req.method === 'POST') {
    try {
      const gasUrl = process.env.GAS_API_URL;
      
      // データの整理（文字列ならオブジェクトに戻す）
      let bodyData = req.body;
      if (typeof bodyData === 'string') {
        try { bodyData = JSON.parse(bodyData); } catch (e) {}
      }

      // 【最強の修正点】
      // 1. URLの後ろにデータをくっつける（e.parameter 対策）
      const urlObj = new URL(gasUrl);
      if (bodyData && typeof bodyData === 'object') {
        Object.keys(bodyData).forEach(key => {
          urlObj.searchParams.append(key, bodyData[key]);
        });
      }

      // 2. 封筒の中身にもデータを入れる（e.postData 対策）
      const jsonBody = JSON.stringify(bodyData);

      // GASへ送信（URLパラメータ付きのアドレスに、JSONを送る）
      const response = await fetch(urlObj.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonBody
      });

      const data = await response.json();
      return res.status(200).json(data);

    } catch (error) {
      console.error("Proxy Error:", error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
