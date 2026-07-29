/**
 * GET /api/devices
 * Returns all registered devices with their status.
 * Response: { devices: [...] }
 */
const { readDevices } = require('./_github');

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { devices } = await readDevices();

    // Convert to array and determine online/offline
    const now = Date.now();
    const deviceList = Object.values(devices).map(d => ({
      id: d.id,
      name: d.name,
      status: (now - d.lastSeen) < 180000 ? 'online' : 'offline',
      // 3 min timeout
      lastSeen: d.lastSeen,
      firstSeen: d.firstSeen,
      ip: d.ip,
      hasPendingCommand: d.pendingCommand !== null && d.pendingCommand !== undefined
    }));

    // Sort: online first, then by name
    deviceList.sort((a, b) => {
      if (a.status === 'online' && b.status !== 'online') return -1;
      if (a.status !== 'online' && b.status === 'online') return 1;
      return a.name.localeCompare(b.name);
    });

    res.json({ devices: deviceList });
  } catch (err) {
    console.error('Devices error:', err);
    res.status(500).json({ error: err.message });
  }
};
