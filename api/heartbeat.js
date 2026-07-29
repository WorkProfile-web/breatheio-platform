/**
 * POST /api/heartbeat
 * ESP32 sends a heartbeat and checks for pending commands.
 * Body: { deviceId: string }
 * Response: { success: true, command: string|null }
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
    const { deviceId } = req.body || {};

    if (!deviceId) {
      return res.status(400).json({ error: 'Missing deviceId' });
    }

    const { devices, sha } = await readDevices();

    // Check if device exists — auto-register if not
    if (!devices[deviceId]) {
      devices[deviceId] = {
        id: deviceId,
        name: `ESP32-${deviceId.substring(0, 6)}`,
        status: 'online',
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        ip: req.headers['x-forwarded-for'] || '',
        pendingCommand: null
      };
      await writeDevices(devices, sha);
      return res.json({ success: true, command: null });
    }

    // Grab any pending command before clearing it
    const command = devices[deviceId].pendingCommand || null;
    devices[deviceId].pendingCommand = null;

    // Update status
    devices[deviceId].status = 'online';
    devices[deviceId].lastSeen = Date.now();
    devices[deviceId].ip = req.headers['x-forwarded-for'] || '';

    await writeDevices(devices, sha);

    res.json({ success: true, command });
  } catch (err) {
    console.error('Heartbeat error:', err);
    res.status(500).json({ error: err.message });
  }
};
