// api/verify-pin.js
// Normal login (account already has a PIN set). Verifies username+PIN
// together — PIN alone is no longer enough since multiple people could
// pick the same PIN; the username scopes exactly which account is being
// checked.

const { verifyLogin } = require('./_lib/auth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, pin } = req.body || {};
  if (!username || !pin) return res.status(400).json({ error: 'Username and PIN required' });

  try {
    const admin = await verifyLogin(username.trim(), pin);
    if (!admin) return res.status(401).json({ error: 'Incorrect PIN.' });
    return res.status(200).json({ name: admin.name, role: admin.role });
  } catch (err) {
    console.error('verify-pin error:', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
};
