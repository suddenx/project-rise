export default async function handler(req, res) {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Access-Control-Allow-Methods’, ‘POST, OPTIONS’);
res.setHeader(‘Access-Control-Allow-Headers’, ‘Content-Type’);

if (req.method === ‘OPTIONS’) return res.status(200).end();
if (req.method !== ‘POST’) return res.status(405).json({ error: ‘Method not allowed’ });

const VERCEL_TOKEN = process.env.VERCEL_DEPLOY_TOKEN;
if (!VERCEL_TOKEN) {
return res.status(500).json({ error: ‘VERCEL_DEPLOY_TOKEN not set in environment variables.’ });
}

let files, userName;
try {
const body = typeof req.body === ‘string’ ? JSON.parse(req.body) : req.body;
files = body?.files;
userName = body?.userName || ‘user’;
} catch (e) {
return res.status(400).json({ error: ‘Invalid request body.’ });
}

if (!files || !Array.isArray(files) || files.length === 0) {
return res.status(400).json({ error: ‘No files provided.’ });
}

// Sanitise name for use in project name
const safeName = userName.toLowerCase().replace(/[^a-z0-9]/g, ‘’).slice(0, 20) || ‘user’;
const projectName = `project-rise-${safeName}-${Date.now().toString(36)}`;

try {
// Step 1 — create the deployment via Vercel API
const deployRes = await fetch(‘https://api.vercel.com/v13/deployments’, {
method: ‘POST’,
headers: {
‘Authorization’: `Bearer ${VERCEL_TOKEN}`,
‘Content-Type’: ‘application/json’,
},
body: JSON.stringify({
name: projectName,
files: files.map(f => ({
file: f.name,
data: f.content,
encoding: ‘utf-8’,
})),
projectSettings: {
framework: null,
outputDirectory: null,
},
target: ‘production’,
}),
});

```
const deployData = await deployRes.json();

if (!deployRes.ok) {
  const detail = deployData?.error?.message || JSON.stringify(deployData);
  console.error('Vercel deploy error:', detail);
  return res.status(deployRes.status).json({ error: 'Vercel error: ' + detail });
}

// Vercel returns the URL — wait for ready state
const url = deployData.url || deployData.alias?.[0];
if (!url) {
  return res.status(500).json({ error: 'No URL returned from Vercel.' });
}

return res.status(200).json({
  url: 'https://' + url,
  projectName,
});
```

} catch (err) {
console.error(‘Deploy error:’, err);
return res.status(500).json({ error: ’Server error: ’ + err.message });
}
}
