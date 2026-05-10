export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, negativePrompt } = req.body;
  const STABILITY_KEY = process.env.STABILITY_API_KEY;

  if (!STABILITY_KEY) return res.status(500).json({ error: 'STABILITY_API_KEY غير موجود' });
  if (!prompt) return res.status(400).json({ error: 'البرومبت فارغ' });

  try {
    const response = await fetch(
      'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${STABILITY_KEY}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          text_prompts: [
            { text: prompt, weight: 1 },
            { text: negativePrompt || 'blurry, low quality, distorted, text, watermark, people, hands', weight: -1 }
          ],
          cfg_scale: 7,
          height: 1024,
          width: 1024,
          samples: 1,
          steps: 30,
          style_preset: 'photographic'
        })
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err.message || `خطأ ${response.status}` });
    }

    const data = await response.json();
    const b64 = data.artifacts?.[0]?.base64;
    if (!b64) return res.status(500).json({ error: 'ما رجعت صورة' });

    return res.status(200).json({ image: b64 });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
