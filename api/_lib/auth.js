// api/_lib/auth.js
// Shared helpers used by every endpoint that touches admin accounts.

const crypto = require('crypto');

function hashPin(pin) {
  return crypto.createHash('sha256').update(pin + process.env.HARVEST_PIN_SALT).digest('hex');
}

async function getAdminByUsername(username) {
  const SUPA_URL = process.env.SUPABASE_URL;
  const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY;
  const res = await fetch(
    `${SUPA_URL}/rest/v1/admins?username=eq.${encodeURIComponent(username)}&select=id,username,name,role,pin_hash`,
    { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } }
  );
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0];
}

// Verifies a username+PIN pair against the database. Returns the admin
// record (without pin_hash) on success, or null on failure. Used by every
// write endpoint — the PIN is re-checked on every single request, not just
// trusted from an earlier login.
async function verifyLogin(username, pin) {
  if (!username || !pin) return null;
  const admin = await getAdminByUsername(username);
  if (!admin || !admin.pin_hash) return null; // no account, or account not yet claimed
  if (admin.pin_hash !== hashPin(pin)) return null;
  return { id: admin.id, name: admin.name, role: admin.role };
}

module.exports = { hashPin, getAdminByUsername, verifyLogin };
