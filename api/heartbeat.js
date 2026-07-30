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
    const { deviceId, deviceSecret, pingResults } = req.body || {};
    if (!deviceId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Missing deviceId' }));
    }

    // FIRST: reload from Blob so we don't auto-register a device that already exists
    await store.reloadFromBlob();

    // Auto-register only if genuinely new (not in memory AND not in Blob)
    let existing = store.getDevice(deviceId);
    if (!existing) {
      // Fallback: try direct Blob read — reloadFromBlob() might have failed on cold start
      const blobDevice = await store.readDeviceFromBlob(deviceId);
      if (blobDevice) {
        // Device exists in Blob! Load into memory without overwriting Blob
        console.log('[HEARTBEAT] Device exists in Blob (but not in memory). Loading...');
        if (!store.getDevice(deviceId)) {
          // Manually add to memory via upsert but DON'T include pendingCommand:null
          await store.upsertDevice(deviceId, { 
            ...blobDevice, 
            status: 'online',
            ip: req.headers['x-forwarded-for'] || ''
          });
        }
        existing = store.getDevice(deviceId);
      } else {
        // Truly new device — auto-register without overwriting pendingCommand
        console.log('[HEARTBEAT] Truly new device, registering:', deviceId);
        const update = {
          name: `ESP32-${deviceId.substring(0, 6)}`,
          status: 'online',
          ip: req.headers['x-forwarded-for'] || '',
          pendingCommand: null
        };
        if (deviceSecret) update.deviceSecret = deviceSecret;
        await store.upsertDevice(deviceId, update);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, command: null }));
      }
    }

    // Update device secret if ESP sent a different one, or set default 123FFF
    if (deviceSecret && (!existing.deviceSecret || existing.deviceSecret !== deviceSecret)) {
      await store.setDeviceSecret(deviceId, deviceSecret);
    } else if (!existing.deviceSecret) {
      await store.setDeviceSecret(deviceId, '123FFF');
    }

    // Check for pending command (uses dedicated command storage — NOT devices-data.json)
    const command = await store.getAndClearDeviceCommand(deviceId);
    
    // Prepare update data
    const updateData = {
      status: 'online',
      ip: req.headers['x-forwarded-for'] || ''
    };

    if (command && command.length > 0) {
      console.log('[HEARTBEAT] Returning command "' + command + '" to device ' + deviceId.substring(0,6) + '...');
      updateData.lastExecutedCommand = {
        action: command,
        time: Date.now()
      };
    }

    // Store ping results if ESP32 sent them
    if (pingResults) {
      updateData.pingResults = pingResults;
      updateData.lastPingTime = Date.now();
    }

    // Update status
    await store.upsertDevice(deviceId, updateData);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, command }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
};
