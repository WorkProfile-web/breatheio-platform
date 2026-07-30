/**
 * POST /api/command
 * Send a command to a specific device.
 * Body: { deviceId: string, action: string, deviceSecret?: string }
 * Actions: "restart", "ping", "led_on", "led_off", or custom
 * Requires matching deviceSecret to control the device.
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
    const { deviceId, action, deviceSecret } = req.body || {};

    if (!deviceId || !action) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Missing deviceId or action' }));
    }

    // Reload from Blob FIRST — ensures device data is fresh even on cold start
    await store.reloadFromBlob();

    const device = store.getDevice(deviceId);
    if (!device) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Device not found' }));
    }

    // Verify device secret
    if (!store.verifyDeviceSecret(deviceId, deviceSecret)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Wrong device password. Each device has its own password set during setup.' }));
    }

    store.setPendingCommand(deviceId, action);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: `Command "${action}" sent to ${deviceId.substring(0, 6)}...` }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
};
