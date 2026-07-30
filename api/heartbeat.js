/**
 * POST /api/heartbeat
 * ESP32 sends heartbeat, auto-registers if new, returns pending command.
 * Body: { deviceId: string }
 * Response: { success: true, command: string|null }
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
    const { deviceId, pingResults } = req.body || {};
    if (!deviceId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Missing deviceId' }));
    }

    // Auto-register if new device
    const existing = store.getDevice(deviceId);
    if (!existing) {
      store.upsertDevice(deviceId, {
        name: `ESP32-${deviceId.substring(0, 6)}`,
        status: 'online',
        ip: req.headers['x-forwarded-for'] || '',
        pendingCommand: null
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, command: null }));
    }

    // Check for pending command (reloads from Blob to catch cross-instance commands)
    const command = await store.getAndClearPendingCommand(deviceId);

    // Prepare update data
    const updateData = {
      status: 'online',
      ip: req.headers['x-forwarded-for'] || ''
    };

    // Store ping results if ESP32 sent them
    if (pingResults) {
      updateData.pingResults = pingResults;
      updateData.lastPingTime = Date.now();
    }

    // Update status
    store.upsertDevice(deviceId, updateData);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, command }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
};
