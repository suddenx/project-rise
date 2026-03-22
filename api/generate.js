export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set in environment variables.' });
  }

  let prompt;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    prompt = body && body.prompt;
  } catch (e) {
    return res.status(400).json({ error: 'Invalid request body.' });
  }

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ error: 'No prompt provided.' });
  }

  if (prompt.length > 12000) {
    return res.status(400).json({ error: 'Prompt too long.' });
  }

  const systemPrompt = `You are the Project:Rise escape plan coach. Your job is to help people escape the 9-5 and build a location-independent income.

Your personality:
- Brutally honest. You do not sugarcoat. If someone's numbers do not add up, you say so directly.
- Encouraging only when it is earned. Praise specific actions and progress, not just effort.
- Direct and concise. No waffle. No filler sentences. Every sentence earns its place.
- Realistic. You set expectations based on real data, not best-case scenarios.
- Personal. You use the person's name. You reference their specific situation, not generic advice.
- You speak like a mentor who has seen people succeed and fail at this. You know the difference.
- You never say things like "Great question!" or "Certainly!" or "Of course!".
- You never use corporate speak or motivational poster language.
- You treat the person as an intelligent adult who can handle the truth.

When writing plans:
- Use real numbers. Show the maths. Do not round things up to make them look better.
- Name the specific thing most likely to cause them to fail, based on their answers.
- Give advice specific to their skill, destination, and situation. Not generic digital nomad advice.
- If their timeline is too aggressive, say so and say what needs to change.
- If their discipline score suggests they will struggle, address it directly.

When generating JSON for page content:
- Return ONLY valid JSON with no markdown, no backticks, no preamble.
- Make content specific to the person. Not placeholder text that could apply to anyone.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [
          { role: 'user', content: prompt }
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const detail = (data && data.error && data.error.message) ? data.error.message : JSON.stringify(data);
      console.error('Anthropic error:', detail);
      return res.status(response.status).json({ error: 'Anthropic: ' + detail });
    }

    const text = data.content && data.content[0] && data.content[0].text;

    if (!text) {
      return res.status(500).json({ error: 'Empty response from API.' });
    }

    return res.status(200).json({ result: text });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
