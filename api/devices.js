/**
 * GET /api/devices
 * Returns all devices with online/offline status.
 */
const store = require('./_store');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  try {
    // Reload from Blob so we always see the latest data (cross-instance)
    await store.reloadFromBlob();
    const now = Date.now();
    const deviceList = store.getAllDevices().map(d => ({
      id: d.id,
      name: d.name,
      status: (now - d.lastSeen) < 180000 ? 'online' : 'offline',
      lastSeen: d.lastSeen,
      firstSeen: d.firstSeen,
      ip: d.ip,
      deviceSecret: d.deviceSecret || '',
      lastExecutedCommand: d.lastExecutedCommand || null,
      pingResults: d.pingResults || null,
      lastPingTime: d.lastPingTime || null
    }));

    deviceList.sort((a, b) => {
      if (a.status === 'online' && b.status !== 'online') return -1;
      if (a.status !== 'online' && b.status === 'online') return 1;
      return a.name.localeCompare(b.name);
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ devices: deviceList }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
};
