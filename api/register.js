/**
 * POST /api/register
 * Register a new ESP32 device with its unique chip ID.
 * Body: { deviceId: string, name?: string }
 */
const { readDevices, writeDevices } = require('./_github');

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { deviceId, name } = req.body || {};

    if (!deviceId) {
      return res.status(400).json({ error: 'Missing deviceId' });
    }

    const { devices, sha } = await readDevices();

    // If device already exists, just update it
    if (devices[deviceId]) {
      devices[deviceId].lastSeen = Date.now();
      devices[deviceId].status = 'online';
      if (name) devices[deviceId].name = name;
    } else {
      // New device — add to the list
      devices[deviceId] = {
        id: deviceId,
        name: name || `ESP32-${deviceId.substring(0, 6)}`,
        status: 'online',
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        ip: req.headers['x-forwarded-for'] || '',
        pendingCommand: null
      };
    }

    await writeDevices(devices, sha);

    res.json({ success: true, deviceId });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: err.message });
  }
};
