export const config = { 
  api: { bodyParser: { sizeLimit: '10mb' }, responseLimit: false },
  maxDuration: 120
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function runModel(owner, name, input, token) {
  // Get latest version
  const modelRes = await fetch(`https://api.replicate.com/v1/models/${owner}/${name}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const model = await modelRes.json();
  const version = model?.latest_version?.id;
  if (!version) throw new Error(`ما لقيت النموذج: ${owner}/${name}`);

  // Run prediction
  const predRes = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ version, input })
  });
  const pred = await predRes.json();
  if (!pred.id) throw new Error(pred.detail || 'فشل تشغيل النموذج');

  // Poll
  for (let i = 0; i < 60; i++) {
    await sleep(3000);
    const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await pollRes.json();
    if (data.status === 'succeeded') return data.output;
    if (data.status === 'failed') throw new Error(data.error || 'فشل النموذج');
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
  const TOKEN = process.env.REPLICATE_API_TOKEN;
  if (!TOKEN) return res.status(500).json({ error: 'REPLICATE_API_TOKEN غير موجود' });

  const imageDataUrl = `data:${imageType || 'image/jpeg'};base64,${imageBase64}`;

  // Angle mapping
  let azimuth = 0, polar = 0;
  if (angle === 'back')              { azimuth = 180; polar = 0; }
  else if (angle === 'front')        { azimuth = 0;   polar = 0; }
  else if (direction === 'right')    { azimuth = 90;  polar = 0; }
  else if (direction === 'left')     { azimuth = -90; polar = 0; }
  else if (direction === 'top-right'){ azimuth = 45;  polar = -30; }
  else if (direction === 'top-left') { azimuth = -45; polar = -30; }

  try {
    // Step 1: Remove background
    const bgOutput = await runModel('cjwbw', 'rembg', { image: imageDataUrl }, TOKEN);
    const cleanUrl = Array.isArray(bgOutput) ? bgOutput[0] : bgOutput;

    // Step 2: Zero123-XL for novel view
    const viewOutput = await runModel('adirik', 'zero123-xl', {
      image: cleanUrl,
      azimuth: azimuth,
      polar: polar,
      image_cfg_scale: 3.0,
    }, TOKEN);

    const resultUrl = Array.isArray(viewOutput) ? viewOutput[0] : viewOutput;
    const resultBase64 = await urlToBase64(resultUrl);

    return res.status(200).json({ image: resultBase64 });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
