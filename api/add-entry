// api/add-entry.js
// Records a real transaction (income or expense). The PIN is verified again
// here, server-side, even though the person already "logged in" on the
// admin page — that login is just UX, this check is the actual security
// boundary. Nothing gets written to the database without a valid PIN
// presented on this exact request.

const { verifyLogin } = require('./_lib/auth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, pin, entry_date, type, category, name, amount, payment_method, note } = req.body || {};
  if (!username || !pin) return res.status(400).json({ error: 'Username and PIN required' });
  if (!type || !['income', 'expense'].includes(type)) return res.status(400).json({ error: 'Type must be income or expense' });
  if (!category) return res.status(400).json({ error: 'Category required' });
  if (!amount || isNaN(amount) || Number(amount) <= 0) return res.status(400).json({ error: 'A valid amount is required' });

  try {
    const admin = await verifyLogin(username, pin);
    if (!admin) return res.status(401).json({ error: 'Incorrect PIN.' });

    const SUPA_URL = process.env.SUPABASE_URL;
    const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY;

    const insertRes = await fetch(`${SUPA_URL}/rest/v1/entries`, {
      method: 'POST',
      headers: {
        apikey: SUPA_KEY,
        Authorization: `Bearer ${SUPA_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        entry_date: entry_date || new Date().toISOString().slice(0, 10),
        type,
        category,
        name: name || null,
        amount: Number(amount),
        payment_method: payment_method || null,
        note: note || null,
        created_by_name: admin.name,
      }),
    });

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      console.error('add-entry insert failed:', errText);
      return res.status(500).json({ error: 'Could not save entry.' });
    }

    const [inserted] = await insertRes.json();
    return res.status(200).json({ ok: true, entry: inserted });
  } catch (err) {
    console.error('add-entry error:', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
};
