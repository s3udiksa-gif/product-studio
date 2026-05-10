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
    left: 'from the left side, 90-degree side angle',
    right: 'from the right side, 90-degree side angle',
    'top-left': 'from upper-left, 45-degree elevated angle',
    'top-right': 'from upper-right, 45-degree elevated angle',
  };
  const angleMap = {
    front: 'directly from the front, straight-on front view',
    back: 'directly from the back, straight-on rear view',
    side: `from the side ${dirMap[direction] || ''}`,
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
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: imageType || 'image/jpeg', data: imageBase64 } },
            {
              type: 'text',
              text: `Analyze this product and return TWO things:
1. DESCRIPTION: One sentence describing the product (type, color, material, brand if visible)
2. PROMPT: A professional Midjourney/Stable Diffusion prompt for a studio photo of this product taken ${viewText}. Include: white seamless background, studio lighting, 8K, hyper-realistic, commercial photography.

Reply ONLY in this format:
DESCRIPTION: [product description]
PROMPT: [image generation prompt]`
            }
          ]
        }]
      })
    });

    const data = await response.json();
    const text = data.content?.map(i => i.text || '').join('') || '';
    const desc = text.match(/DESCRIPTION:\s*(.+)/i)?.[1]?.trim() || '';
    const prompt = text.match(/PROMPT:\s*([\s\S]+)/i)?.[1]?.trim() || '';

    return res.status(200).json({ description: desc, prompt });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
