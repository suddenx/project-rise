export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const VERCEL_TOKEN = process.env.VERCEL_DEPLOY_TOKEN;
  if (!VERCEL_TOKEN) {
    return res.status(500).json({ error: 'VERCEL_DEPLOY_TOKEN not set in environment variables.' });
  }

  let files, userName;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    files = body.files;
    userName = body.userName || 'user';
  } catch (e) {
    return res.status(400).json({ error: 'Invalid request body.' });
  }

  if (!files || !Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: 'No files provided.' });
  }

  // Sanitise name - Vercel project names must be lowercase alphanumeric + hyphens
  const safeName = userName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16) || 'user';
  const uniqueSuffix = Date.now().toString(36).slice(-6);
  const projectName = 'pr-' + safeName + '-' + uniqueSuffix;

  try {
    // Convert file contents to sha + data format Vercel expects
    const vercelFiles = files.map(f => ({
      file: f.name,
      data: Buffer.from(f.content, 'utf-8').toString('base64'),
      encoding: 'base64',
    }));

    const deployRes = await fetch('https://api.vercel.com/v13/deployments', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + VERCEL_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: projectName,
        files: vercelFiles,
        projectSettings: {
          framework: null,
        },
      }),
    });

    const deployData = await deployRes.json();

    if (!deployRes.ok) {
      const detail = (deployData && deployData.error && deployData.error.message) 
        ? deployData.error.message 
        : JSON.stringify(deployData);
      console.error('Vercel deploy error:', detail);
      return res.status(deployRes.status).json({ error: 'Vercel error: ' + detail });
    }

    const url = deployData.url || (deployData.alias && deployData.alias[0]);
    if (!url) {
      return res.status(500).json({ error: 'No URL returned from Vercel. Response: ' + JSON.stringify(deployData).slice(0, 200) });
    }

    return res.status(200).json({
      url: 'https://' + url,
      projectName,
    });

  } catch (err) {
    console.error('Deploy error:', err);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
