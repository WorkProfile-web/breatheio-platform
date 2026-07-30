/**
 * POST /api/register
 * Register a new ESP32 device.
 * Body: { deviceId: string, name?: string }
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
    const { deviceId, name } = req.body || {};
    if (!deviceId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Missing deviceId' }));
    }

    store.upsertDevice(deviceId, {
      name: name || `ESP32-${deviceId.substring(0, 6)}`,
      status: 'online',
      ip: req.headers['x-forwarded-for'] || '',
      pendingCommand: null
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, deviceId }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
};
