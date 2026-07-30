/**
 * POST /api/rename
 * Rename a device from the dashboard.
 * Body: { deviceId: string, name: string, deviceSecret?: string }
 * Response: { success: true } or { error: '...' }
 */
const store = require('./_store');

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
    const { deviceId, name, deviceSecret } = req.body || {};

    if (!deviceId || !name) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Missing deviceId or name' }));
    }

    // Verify device secret
    if (!store.verifyDeviceSecret(deviceId, deviceSecret)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Wrong device password' }));
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
