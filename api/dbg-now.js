/**
 * GET /api/dbg-now?deviceId=XXXX
 * Debug endpoint — shows the EXACT current GitHub Gist state:
 * - What's in server memory?
 * - What's in GitHub Gist DB?
 * - What's the pendingCommand?
 */
const store = require('./_store');

const GIST_ID = process.env.GITHUB_GIST_ID;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

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
    gist: null,
    commandFile: null,
    env: {
      hasGistId: !!GIST_ID,
      hasGithubToken: !!GITHUB_TOKEN,
      gistIdLength: GIST_ID ? GIST_ID.length : 0
    }
  };

  // 1. Check in-memory cache
  const memDevice = store.getDevice(deviceId);
  if (memDevice) {
    result.memory = {
      name: memDevice.name,
      status: memDevice.status,
      hasDeviceSecret: !!memDevice.deviceSecret,
      lastSeen: memDevice.lastSeen
    };
  } else {
    result.memory = 'NOT FOUND in memory';
  }

  // 2. Check GitHub Gist directly
  try {
    if (GIST_ID && GITHUB_TOKEN) {
      const resp = await fetch(`https://api.github.com/gists/${GIST_ID}?t=${Date.now()}`, {
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'BreatheIO-Platform'
        },
        cache: 'no-store'
      });
      if (resp.ok) {
        const gist = await resp.json();
        const files = gist.files || {};
        if (files['devices-data.json'] && files['devices-data.json'].content) {
          const data = JSON.parse(files['devices-data.json'].content);
          if (data && data.devices && data.devices[deviceId]) {
            const dev = data.devices[deviceId];
            result.gist = {
              name: dev.name,
              status: dev.status,
              hasDeviceSecret: !!dev.deviceSecret,
              lastSeen: dev.lastSeen
            };
          } else {
            result.gist = 'Device NOT FOUND in Gist';
          }
          result.gistAllDeviceCount = data && data.devices ? Object.keys(data.devices).length : 0;
        } else {
          result.gist = 'Gist missing "devices-data.json" file';
        }

        const cmdFileName = `cmd-${deviceId}.json`;
        if (files[cmdFileName] && files[cmdFileName].content) {
          try {
            result.commandFile = JSON.parse(files[cmdFileName].content);
          } catch (e) {
            result.commandFile = files[cmdFileName].content;
          }
        } else {
          result.commandFile = 'No pending command file in Gist';
        }
      } else {
        result.gist = `GitHub API fetch failed: HTTP ${resp.status}`;
      }
    }
  } catch (e) {
    result.gist = 'Error: ' + e.message;
  }

  res.end(JSON.stringify(result, null, 2));
};
