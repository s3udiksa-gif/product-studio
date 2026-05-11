export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function pollReplicate(predictionId, token) {
  for (let i = 0; i < 60; i++) {
    await sleep(3000);
    const res = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.status === 'succeeded') return data.output;
    if (data.status === 'failed') throw new Error(data.error || 'فشل التوليد');
  }
  throw new Error('انتهى الوقت');
}

async function urlToBase64(url) {
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  return Buffer.from(buffer).toString('base64');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageBase64, imageType, angle, direction } = req.body;
  const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN;

  if (!REPLICATE_TOKEN) return res.status(500).json({ error: 'REPLICATE_API_TOKEN غير موجود' });

  // Map angle/direction to azimuth/elevation angles for Zero123
  let azimuth = 0;
  let elevation = 0;

  if (angle === 'front') { azimuth = 0; elevation = 0; }
  else if (angle === 'back') { azimuth = 180; elevation = 0; }
  else if (angle === 'side') {
    if (direction === 'left') { azimuth = -90; elevation = 0; }
    else if (direction === 'right') { azimuth = 90; elevation = 0; }
    else if (direction === 'top-left') { azimuth = -45; elevation = 30; }
    else if (direction === 'top-right') { azimuth = 45; elevation = 30; }
  }

  const imageDataUrl = `data:${imageType || 'image/jpeg'};base64,${imageBase64}`;

  try {
    // Step 1: Remove background using Replicate
    const bgRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${REPLICATE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: '4067ee2a58f6c161d434a9c077cfa012820b8e076efa2772aa171e26557da919',
        input: { image: imageDataUrl }
      })
    });

    const bgPred = await bgRes.json();
    if (!bgPred.id) throw new Error('فشل إزالة الخلفية: ' + JSON.stringify(bgPred));

    const bgOutput = await pollReplicate(bgPred.id, REPLICATE_TOKEN);
    const cleanImageUrl = Array.isArray(bgOutput) ? bgOutput[0] : bgOutput;

    // Step 2: Generate new view using Zero123
    const viewRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${REPLICATE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: 'ed6d8bee9a278b0d7125872bddfb9dd3fc4c401426ad634d8246a660e387475b',
        input: {
          image: cleanImageUrl,
          elevation: elevation,
          azimuth: azimuth,
        }
      })
    });

    const viewPred = await viewRes.json();
    if (!viewPred.id) throw new Error('فشل توليد الزاوية: ' + JSON.stringify(viewPred));

    const viewOutput = await pollReplicate(viewPred.id, REPLICATE_TOKEN);
    const resultUrl = Array.isArray(viewOutput) ? viewOutput[0] : viewOutput;

    // Convert to base64
    const resultBase64 = await urlToBase64(resultUrl);

    return res.status(200).json({ image: resultBase64 });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
