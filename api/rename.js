/**
 * POST /api/rename
 * Rename a device from the dashboard.
 * Body: { deviceId: string, name: string, pin?: string }
 * Response: { success: true } or { error: '...' }
 */
const store = require('./_store');

function parsePinCookie(cookieHeader) {
  if (!cookieHeader) return null;
  for (const pair of cookieHeader.split(';')) {
    const [k, ...v] = pair.split('=');
    if (k && k.trim() === 'bio_pin') return v.join('=').trim();
  }
  return null;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  try {
    const { deviceId, name } = req.body || {};

    // Check PIN: body > cookie > env
    const pin = req.body.pin || parsePinCookie(req.headers.cookie);
    if (!store.checkPin(pin)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Invalid PIN' }));
    }

    if (!deviceId || !name) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Missing deviceId or name' }));
    }

    const cleaned = name.trim().substring(0, 32);
    if (cleaned.length < 1) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Name cannot be empty' }));
    }

    const ok = store.renameDevice(deviceId, cleaned);
    if (!ok) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Device not found' }));
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, name: cleaned }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
};
