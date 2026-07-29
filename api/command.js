/**
 * POST /api/command
 * Send a command to a specific device.
 * Body: { deviceId: string, action: string }
 * Actions: "restart", "ping", "led_on", "led_off", or any custom action
 */
const { readDevices, writeDevices } = require('./_github');

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { deviceId, action } = req.body || {};

    if (!deviceId || !action) {
      return res.status(400).json({ error: 'Missing deviceId or action' });
    }

    const { devices, sha } = await readDevices();

    if (!devices[deviceId]) {
      return res.status(404).json({ error: 'Device not found' });
    }

    devices[deviceId].pendingCommand = action;

    await writeDevices(devices, sha);

    res.json({ success: true, message: `Command "${action}" sent to ${deviceId}` });
  } catch (err) {
    console.error('Command error:', err);
    res.status(500).json({ error: err.message });
  }
};
