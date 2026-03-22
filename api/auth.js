const SUPABASE_URL = 'https://vyhtfurujnvpgthdddpm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5aHRmdXJ1am52cGd0aGRkZHBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTQ1MjQsImV4cCI6MjA4OTU5MDUyNH0.kRKhZLM9oVjO9PZXGHNgCYKQMbjEB36Y1aMx_0Czf3s';

const HEADERS = {
  'apikey': SUPABASE_KEY,
  'Authorization': 'Bearer ' + SUPABASE_KEY,
  'Content-Type': 'application/json',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let action, username, password, site_url, name, notes;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    action = body.action;
    username = (body.username || '').trim().toLowerCase();
    password = (body.password || '').trim();
    site_url = body.site_url || '';
    name = body.name || '';
    notes = body.notes || '';
  } catch (e) {
    return res.status(400).json({ error: 'Invalid request body.' });
  }

  // GET_NOTES and SAVE_NOTES only need username
  if (action === 'get_notes') {
    if (!username) return res.status(400).json({ error: 'Username required.' });
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/users?username=eq.${encodeURIComponent(username)}&select=chat_notes`,
      { headers: HEADERS }
    );
    const data = await r.json();
    if (!data || data.length === 0) return res.status(200).json({ notes: '' });
    return res.status(200).json({ notes: data[0].chat_notes || '' });
  }

  if (action === 'save_notes') {
    if (!username) return res.status(400).json({ error: 'Username required.' });
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/users?username=eq.${encodeURIComponent(username)}`,
      {
        method: 'PATCH',
        headers: { ...HEADERS, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ chat_notes: notes }),
      }
    );
    if (!r.ok) {
      const err = await r.text();
      return res.status(500).json({ error: 'Failed to save notes: ' + err });
    }
    return res.status(200).json({ success: true });
  }

  // LOGIN and REGISTER require username + password
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required.' });
  }

  // LOGIN
  if (action === 'login') {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/users?username=eq.${encodeURIComponent(username)}&select=username,password,site_url,name,chat_notes`,
      { headers: HEADERS }
    );
    const data = await r.json();
    if (!data || data.length === 0) return res.status(401).json({ error: 'Username not found.' });
    const user = data[0];
    if (user.password !== password) return res.status(401).json({ error: 'Incorrect password.' });
    return res.status(200).json({
      success: true,
      site_url: user.site_url,
      name: user.name,
      chat_notes: user.chat_notes || '',
    });
  }

  // REGISTER
  if (action === 'register') {
    if (!site_url) return res.status(400).json({ error: 'site_url required for registration.' });
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?username=eq.${encodeURIComponent(username)}&select=username`,
      { headers: HEADERS }
    );
    const existing = await checkRes.json();
    if (existing && existing.length > 0) return res.status(409).json({ error: 'Username already taken. Please choose another.' });

    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
      method: 'POST',
      headers: { ...HEADERS, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ username, password, site_url, name, chat_notes: '' }),
    });
    if (!insertRes.ok) {
      const err = await insertRes.text();
      return res.status(500).json({ error: 'Failed to register: ' + err });
    }
    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: 'Invalid action.' });
}
