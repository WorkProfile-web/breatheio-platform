/**
 * GET /api/dbg-now?deviceId=XXXX
 * Debug endpoint — shows the EXACT current state:
 * - What's in server memory?
 * - What's in Blob?
 * - What's the pendingCommand?
 */
const store = require('./_store');
const { head } = require('@vercel/blob');

const BLOB_PATH = 'devices-data.json';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const deviceId = req.query && req.query.deviceId;
  if (!deviceId) {
    return res.end(JSON.stringify({ error: 'Missing ?deviceId=XXXX' }));
  }

  const result = {
    deviceId,
    memory: null,
    blob: null,
    commandFile: null,
    env: {
      hasToken: !!process.env.BLOB_READ_WRITE_TOKEN,
      tokenLength: process.env.BLOB_READ_WRITE_TOKEN ? process.env.BLOB_READ_WRITE_TOKEN.length : 0
    }
  };

  // 1. Check in-memory cache
  const memDevice = store.getDevice(deviceId);
  if (memDevice) {
    result.memory = {
      name: memDevice.name,
      status: memDevice.status,
      pendingCommand: memDevice.pendingCommand || null,
      hasDeviceSecret: !!memDevice.deviceSecret,
      lastSeen: memDevice.lastSeen
    };
  } else {
    result.memory = 'NOT FOUND in memory';
  }

  // 2. Check Blob directly
  try {
    const blobInfo = await head(BLOB_PATH).catch(e => {
      result.blob = 'head() failed: ' + e.message;
      return null;
    });
    if (blobInfo) {
      const resp = await fetch(blobInfo.url, {
        headers: { Authorization: 'Bearer ' + process.env.BLOB_READ_WRITE_TOKEN }
      }).catch(e => {
        result.blob = 'fetch() failed: ' + e.message;
        return null;
      });
      if (resp && resp.ok) {
        const data = await resp.json();
        if (data && data.devices) {
          const blobDevice = data.devices[deviceId];
          if (blobDevice) {
            result.blob = {
              name: blobDevice.name,
              status: blobDevice.status,
              pendingCommand: blobDevice.pendingCommand || null,
              hasDeviceSecret: !!blobDevice.deviceSecret,
              lastSeen: blobDevice.lastSeen
            };
          } else {
            result.blob = 'Device NOT FOUND in Blob';
          }
          result.blobAllDeviceCount = Object.keys(data.devices).length;
        } else {
          result.blob = 'Blob has no "devices" key';
          result.blobRaw = JSON.stringify(data).substring(0, 200);
        }
      } else if (resp) {
        result.blob = 'fetch status: ' + resp.status;
      }
    }
  } catch (e) {
    result.blob = 'Error: ' + e.message;
  }

  // 3. Check for pending command file
  try {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const cmdPath = 'cmd-' + deviceId + '.json';
      const cmdInfo = await head(cmdPath).catch(() => null);
      if (cmdInfo) {
        const cmdResp = await fetch(cmdInfo.url, {
          headers: { Authorization: 'Bearer ' + process.env.BLOB_READ_WRITE_TOKEN }
        });
        if (cmdResp.ok) {
          const cmdData = await cmdResp.json();
          result.commandFile = cmdData;
        }
      } else {
        result.commandFile = 'No command file found';
      }
    }
  } catch (e) {
    result.commandFile = 'Error: ' + e.message;
  }

  res.end(JSON.stringify(result, null, 2));
};
