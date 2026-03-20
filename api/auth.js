const SUPABASE_URL = 'https://vyhtfurujnvpgthdddpm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5aHRmdXJ1am52cGd0aGRkZHBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTQ1MjQsImV4cCI6MjA4OTU5MDUyNH0.kRKhZLM9oVjO9PZXGHNgCYKQMbjEB36Y1aMx_0Czf3s';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let action, username, password, site_url, name;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    action = body.action;
    username = (body.username || '').trim().toLowerCase();
    password = (body.password || '').trim();
    site_url = body.site_url || '';
    name = body.name || '';
  } catch (e) {
    return res.status(400).json({ error: 'Invalid request body.' });
  }

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required.' });
  }

  // LOGIN
  if (action === 'login') {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/users?username=eq.${encodeURIComponent(username)}&select=username,password,site_url,name`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
        }
      }
    );
    const data = await response.json();
    if (!data || data.length === 0) {
      return res.status(401).json({ error: 'Username not found.' });
    }
    const user = data[0];
    if (user.password !== password) {
      return res.status(401).json({ error: 'Incorrect password.' });
    }
    return res.status(200).json({ 
      success: true, 
      site_url: user.site_url,
      name: user.name
    });
  }

  // REGISTER
  if (action === 'register') {
    if (!site_url) return res.status(400).json({ error: 'site_url required for registration.' });

    // Check username not taken
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?username=eq.${encodeURIComponent(username)}&select=username`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
        }
      }
    );
    const existing = await checkRes.json();
    if (existing && existing.length > 0) {
      return res.status(409).json({ error: 'Username already taken. Please choose another.' });
    }

    // Insert new user
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ username, password, site_url, name })
    });

    if (!insertRes.ok) {
      const err = await insertRes.text();
      return res.status(500).json({ error: 'Failed to register: ' + err });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: 'Invalid action. Use login or register.' });
}
