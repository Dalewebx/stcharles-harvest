// api/check-username.js
// Step 1 of login: given a username, tells the app whether this is a brand
// new account (needs to set a PIN) or an existing one (needs to enter their
// PIN as normal). Deliberately doesn't reveal anything else — no PIN,
// no hash, nothing sensitive, just enough to route to the right screen.

const { getAdminByUsername } = require('./_lib/auth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username } = req.body || {};
  if (!username) return res.status(400).json({ error: 'Username required' });

  try {
    const admin = await getAdminByUsername(username.trim());
    if (!admin) return res.status(404).json({ error: 'That username was not recognized.' });

    return res.status(200).json({
      needsSetup: !admin.pin_hash,
      name: admin.name,
      role: admin.role,
    });
  } catch (err) {
    console.error('check-username error:', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
};
