// api/delete-entry.js
// Deletes a wrongly-entered transaction. Any logged-in admin can delete any
// entry (not just their own), since this is a small trusted committee and
// mistakes need fixing fast during a live service, not routed through
// whoever happened to log it.
//
// If the entry being deleted was created by fulfilling a pledge (it's
// linked from a pledges row via fulfilled_entry_id), that pledge is
// reverted back to "pending" rather than left pointing at a deleted row,
// so it correctly reappears in Outstanding Pledges instead of silently
// vanishing from both places.

const { verifyLogin } = require('./_lib/auth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, pin, entry_id } = req.body || {};
  if (!username || !pin) return res.status(400).json({ error: 'Username and PIN required' });
  if (!entry_id) return res.status(400).json({ error: 'entry_id required' });

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

    // If a pledge was fulfilled by this exact entry, revert it to pending
    // first, so it doesn't end up pointing at nothing.
    const pledgeRes = await fetch(`${SUPA_URL}/rest/v1/pledges?fulfilled_entry_id=eq.${entry_id}&select=id`, { headers });
    const linkedPledges = await pledgeRes.json();
    if (Array.isArray(linkedPledges) && linkedPledges.length > 0) {
      await fetch(`${SUPA_URL}/rest/v1/pledges?fulfilled_entry_id=eq.${entry_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'pending', fulfilled_entry_id: null, fulfilled_at: null }),
      });
    }

    const deleteRes = await fetch(`${SUPA_URL}/rest/v1/entries?id=eq.${entry_id}`, {
      method: 'DELETE',
      headers,
    });

    if (!deleteRes.ok) {
      const errText = await deleteRes.text();
      console.error('delete-entry failed:', errText);
      return res.status(500).json({ error: 'Could not delete entry.' });
    }

    return res.status(200).json({ ok: true, revertedPledge: linkedPledges.length > 0 });
  } catch (err) {
    console.error('delete-entry error:', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
};
