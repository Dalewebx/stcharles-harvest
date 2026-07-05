// api/fulfill-pledge.js
// When a pledge actually gets paid, this creates the real income entry AND
// marks the pledge fulfilled, linking the two — so anyone looking at the
// pledge later can see exactly which transaction paid it off, rather than
// the pledge just quietly disappearing.

const { verifyLogin } = require('./_lib/auth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, pin, pledge_id, amount, payment_method, entry_date } = req.body || {};
  if (!username || !pin) return res.status(400).json({ error: 'Username and PIN required' });
  if (!pledge_id) return res.status(400).json({ error: 'pledge_id required' });
  if (!amount || isNaN(amount) || Number(amount) <= 0) return res.status(400).json({ error: 'A valid amount is required' });

  try {
    const admin = await verifyLogin(username, pin);
    if (!admin) return res.status(401).json({ error: 'Incorrect PIN.' });

    const SUPA_URL = process.env.SUPABASE_URL;
    const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY;
    const headers = {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
    };

    // Look up the pledge first so we know its category/name for the new entry
    const pledgeRes = await fetch(`${SUPA_URL}/rest/v1/pledges?id=eq.${pledge_id}&select=*`, { headers });
    const pledgeRows = await pledgeRes.json();
    if (!Array.isArray(pledgeRows) || pledgeRows.length === 0) {
      return res.status(404).json({ error: 'Pledge not found.' });
    }
    const pledge = pledgeRows[0];
    if (pledge.status === 'fulfilled') {
      return res.status(400).json({ error: 'This pledge has already been marked fulfilled.' });
    }

    // Create the real entry
    const entryInsertRes = await fetch(`${SUPA_URL}/rest/v1/entries`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({
        entry_date: entry_date || new Date().toISOString().slice(0, 10),
        type: 'income',
        category: pledge.category,
        name: pledge.name,
        amount: Number(amount),
        payment_method: payment_method || null,
        note: 'Fulfilled pledge from ' + pledge.pledge_date,
        created_by_name: admin.name,
      }),
    });
    if (!entryInsertRes.ok) {
      const errText = await entryInsertRes.text();
      console.error('fulfill-pledge entry insert failed:', errText);
      return res.status(500).json({ error: 'Could not record the payment.' });
    }
    const [newEntry] = await entryInsertRes.json();

    // Mark the pledge fulfilled, linked to the new entry
    const updateRes = await fetch(`${SUPA_URL}/rest/v1/pledges?id=eq.${pledge_id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        status: 'fulfilled',
        fulfilled_entry_id: newEntry.id,
        fulfilled_at: new Date().toISOString(),
      }),
    });
    if (!updateRes.ok) {
      const errText = await updateRes.text();
      console.error('fulfill-pledge update failed:', errText);
      return res.status(500).json({ error: 'Payment recorded, but could not update the pledge status. Please check manually.' });
    }

    return res.status(200).json({ ok: true, entry: newEntry });
  } catch (err) {
    console.error('fulfill-pledge error:', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
};
