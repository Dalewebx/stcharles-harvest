// api/claim-account.js
// Called the first time someone logs in with their username and the account
// has no PIN yet. Sets the PIN they choose. Can only run once per account —
// if a PIN already exists, this refuses, so no one can "reclaim" and reset
// someone else's account this way. Changing an existing PIN would need its
// own separate, deliberate flow (not built here, since it wasn't asked for).

const { hashPin, getAdminByUsername } = require('./_lib/auth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, pin } = req.body || {};
  if (!username || !pin) return res.status(400).json({ error: 'Username and PIN required' });
  if (pin.length < 4) return res.status(400).json({ error: 'PIN must be at least 4 digits.' });

  try {
    const admin = await getAdminByUsername(username.trim());
    if (!admin) return res.status(404).json({ error: 'That username was not recognized.' });
    if (admin.pin_hash) return res.status(400).json({ error: 'This account already has a PIN set. Please log in normally.' });

    const SUPA_URL = process.env.SUPABASE_URL;
    const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY;

    const updateRes = await fetch(`${SUPA_URL}/rest/v1/admins?id=eq.${admin.id}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPA_KEY,
        Authorization: `Bearer ${SUPA_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pin_hash: hashPin(pin) }),
    });

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      console.error('claim-account update failed:', errText);
      return res.status(500).json({ error: 'Could not save your PIN. Please try again.' });
    }

    return res.status(200).json({ name: admin.name, role: admin.role });
  } catch (err) {
    console.error('claim-account error:', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
};
