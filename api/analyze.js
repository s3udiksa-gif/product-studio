export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { angle, direction } = req.body;

  const dirMap = {
    left: 'from the left side, 90-degree side angle',
    right: 'from the right side, 90-degree side angle',
    'top-left': 'from upper-left, 45-degree elevated angle',
    'top-right': 'from upper-right, 45-degree elevated angle',
  };

  const angleMap = {
    front: 'directly from the front, straight-on front view',
    back: 'directly from the back, straight-on rear view',
    side: `from the side ${dirMap[direction] || 'from the left side'}`,
  };

  const viewText = angleMap[angle] || 'front view';

  const prompt = `Professional commercial product photography, photographed ${viewText}, pure white seamless studio background, soft box studio lighting, sharp focus, 8K resolution, hyper-realistic, clean shadows, luxury brand advertisement style, no text, no watermark, high-end product shot`;

  return res.status(200).json({ description: 'product', prompt });
}
