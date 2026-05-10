export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageBase64, imageType, prompt, negativePrompt } = req.body;
  const STABILITY_KEY = process.env.STABILITY_API_KEY;

  if (!STABILITY_KEY) return res.status(500).json({ error: 'STABILITY_API_KEY غير موجود في الإعدادات' });

  try {
    const byteChars = Buffer.from(imageBase64, 'base64');
    const blob = new Blob([byteChars], { type: imageType || 'image/jpeg' });

    const formData = new FormData();
    formData.append('init_image', blob, 'product.png');
    formData.append('init_image_mode', 'IMAGE_STRENGTH');
    formData.append('image_strength', '0.35');
    formData.append('text_prompts[0][text]', prompt);
    formData.append('text_prompts[0][weight]', '1');
    formData.append('text_prompts[1][text]', negativePrompt);
    formData.append('text_prompts[1][weight]', '-1');
    formData.append('cfg_scale', '7');
    formData.append('samples', '1');
    formData.append('steps', '30');
    formData.append('style_preset', 'photographic');

    const response = await fetch(
      'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/image-to-image',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${STABILITY_KEY}`,
          Accept: 'application/json',
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err.message || 'خطأ من Stability AI' });
    }

    const data = await response.json();
    const b64 = data.artifacts?.[0]?.base64;
    if (!b64) return res.status(500).json({ error: 'ما رجعت صورة' });

    return res.status(200).json({ image: b64 });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
