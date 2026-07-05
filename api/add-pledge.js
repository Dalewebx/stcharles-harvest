// api/add-pledge.js
const { verifyLogin } = require('./_lib/auth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, pin, pledge_date, category, name, amount } = req.body || {};
  if (!username || !pin) return res.status(400).json({ error: 'Username and PIN required' });
  if (!category) return res.status(400).json({ error: 'Category required' });
  if (!name) return res.status(400).json({ error: 'Name required for a pledge' });
  if (!amount || isNaN(amount) || Number(amount) <= 0) return res.status(400).json({ error: 'A valid amount is required' });
  const resolvedDate = pledge_date || new Date().toISOString().slice(0, 10);
  const todayStr = new Date().toISOString().slice(0, 10);
  if (resolvedDate > todayStr) return res.status(400).json({ error: 'The date cannot be ahead of today.' });

  try {
    const admin = await verifyLogin(username, pin);
    if (!admin) return res.status(401).json({ error: 'Incorrect PIN.' });

    const SUPA_URL = process.env.SUPABASE_URL;
    const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY;

    const insertRes = await fetch(`${SUPA_URL}/rest/v1/pledges`, {
      method: 'POST',
      headers: {
        apikey: SUPA_KEY,
        Authorization: `Bearer ${SUPA_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        pledge_date: resolvedDate,
        category,
        name,
        amount: Number(amount),
        status: 'pending',
        created_by_name: admin.name,
      }),
    });

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      console.error('add-pledge insert failed:', errText);
      return res.status(500).json({ error: 'Could not save pledge.' });
    }

    const [inserted] = await insertRes.json();
    return res.status(200).json({ ok: true, pledge: inserted });
  } catch (err) {
    console.error('add-pledge error:', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
};
