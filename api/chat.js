const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured.' });

  let messages, profile;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    messages = body.messages;
    profile = body.profile || {};
  } catch (e) {
    return res.status(400).json({ error: 'Invalid request body.' });
  }

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'No messages provided.' });
  }

  const name = profile.name || 'there';
  const destination = profile.destination || 'your destination';
  const departure = profile.departure || 'your departure date';
  const skill = profile.skill || 'your skill';
  const daysLeft = profile.daysLeft || 'unknown';
  const savedSoFar = profile.savedSoFar || 0;
  const budgetTarget = profile.budgetTarget || 0;
  const weeklyTarget = profile.weeklyTarget || 0;
  const sym = profile.currencySymbol || '\u00a3';
  const discipline = profile.discipline || 'moderate';
  const weakness = profile.weakness || 'unknown';
  const why = profile.why || 'unknown';
  const phase = profile.phase || 'building phase';
  const savedNotes = profile.savedNotes || '';

  const notesSection = savedNotes
    ? `\nWHAT YOU REMEMBER ABOUT THEM FROM PREVIOUS CONVERSATIONS:\n${savedNotes}\n`
    : '';

  const systemPrompt = `You are the Project:Rise coach for ${name}. You know their plan inside out. You are their personal mentor.

THEIR PROFILE:
- Name: ${name}
- Escaping to: ${destination} by ${departure} (${daysLeft} days away)
- Building: ${skill}
- Discipline level: ${discipline}
- Biggest weakness: ${weakness}
- Why they want to escape: ${why}
- Current phase: ${phase}
- Savings: ${sym}${savedSoFar} saved of ${sym}${budgetTarget} target
- Weekly savings target: ${sym}${weeklyTarget}/week
${notesSection}
YOUR PERSONALITY:
- Brutally honest. Never sugarcoat. If they are off track, say so directly.
- Encouraging only when it is earned. Reference their actual progress.
- Direct and concise. No waffle. Every sentence earns its place.
- Personal. Always use their name. Reference their specific situation.
- Never say "Great question!" or "Certainly!" or "Of course!".
- Treat them as an intelligent adult who can handle the truth.
- Keep responses under 150 words unless a detailed answer is genuinely needed.
- If they mention progress, wins, or struggles, acknowledge them specifically.
- You can be warm but never soft.

MEMORY INSTRUCTIONS:
At the end of your reply, if the user shared anything worth remembering (a win, a setback, a decision, a new goal, something personal about their situation), append it in this exact format on a new line:
[REMEMBER: one concise sentence about what they shared]
Only include this if there is genuinely something worth saving. Do not force it. Never include it for routine questions.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system: systemPrompt,
        messages: messages,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      const detail = (data && data.error && data.error.message) ? data.error.message : JSON.stringify(data);
      return res.status(response.status).json({ error: 'API error: ' + detail });
    }

    const fullText = data.content && data.content[0] && data.content[0].text;
    if (!fullText) return res.status(500).json({ error: 'Empty response.' });

    // Extract memory note if present
    const rememberMatch = fullText.match(/\[REMEMBER:\s*(.+?)\]/);
    const newMemory = rememberMatch ? rememberMatch[1].trim() : null;

    // Strip the [REMEMBER: ...] tag from the visible reply
    const visibleReply = fullText.replace(/\n?\[REMEMBER:.*?\]/g, '').trim();

    return res.status(200).json({
      reply: visibleReply,
      newMemory: newMemory,
    });

  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
