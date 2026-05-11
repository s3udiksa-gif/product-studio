export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageBase64, imageType, angle, direction } = req.body;
  const CLAUDE_KEY = process.env.ANTHROPIC_API_KEY;

  if (!CLAUDE_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY غير موجود' });

  const dirMap = {
    left: 'from the left side at 90 degrees',
    right: 'from the right side at 90 degrees',
    'top-left': 'from the upper-left at 45 degrees',
    'top-right': 'from the upper-right at 45 degrees',
  };

  const angleMap = {
    front: 'straight-on front view',
    back: 'straight-on back view',
    side: `side view ${dirMap[direction] || 'from the left'}`,
  };

  const viewText = angleMap[angle] || 'front view';

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: imageType || 'image/jpeg', data: imageBase64 }
            },
            {
              type: 'text',
              text: `Look at this product image carefully. Describe ONLY the product itself in detail: what type of product it is, its color, material, shape, brand name if visible, and any key features. Be specific and precise. Reply with ONE sentence only, no extra text. Example: "A sleek black Apple iPhone 15 Pro smartphone with titanium frame and triple camera system"`
            }
          ]
        }]
      })
    });

    const data = await response.json();
    const productDesc = data.content?.map(i => i.text || '').join('').trim();

    if (!productDesc) return res.status(500).json({ error: 'فشل تحليل الصورة' });

    const prompt = `Professional commercial product photography of ${productDesc}, ${viewText}, pure white seamless studio background, soft box studio lighting, sharp focus, 8K resolution, hyper-realistic, clean soft shadows, luxury brand advertisement style, isolated product shot, no people, no text, no watermark`;

    return res.status(200).json({ description: productDesc, prompt });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
