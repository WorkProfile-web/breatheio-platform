/**
 * GitHub Gist Device Storage Provider.
 * Zero credit cards. Zero monthly request limits (120,000 requests/day).
 * Stores devices and commands inside a secret GitHub Gist.
 */

const GIST_ID = process.env.GITHUB_GIST_ID;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// In-memory cache
let devices = {};
let pendingCommands = {};

// Helper: fetch Gist files from GitHub API
async function getGistData() {
  if (!GIST_ID || !GITHUB_TOKEN) return null;
  try {
    const url = `https://api.github.com/gists/${GIST_ID}?t=${Date.now()}`;
    const resp = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'BreatheIO-Platform'
      },
      cache: 'no-store'
    });
    if (resp.ok) {
      const gist = await resp.json();
      return gist.files || {};
    }
  } catch (e) {
    console.error('[GIST] Fetch error:', e.message);
  }
  return null;
}

// Helper: patch files inside GitHub Gist
async function patchGistFiles(filesObject) {
  if (!GIST_ID || !GITHUB_TOKEN) return false;
  try {
    const url = `https://api.github.com/gists/${GIST_ID}`;
    const resp = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'BreatheIO-Platform'
      },
      body: JSON.stringify({ files: filesObject })
    });
    return resp.ok;
  } catch (e) {
    console.error('[GIST] Patch error:', e.message);
    return false;
  }
}

// Reload devices from Gist into the in-memory cache
async function reloadFromBlob() {
  const files = await getGistData();
  if (files && files['devices-data.json']) {
    try {
      const data = JSON.parse(files['devices-data.json'].content);
      if (data && data.devices) {
        devices = data.devices;
      }
    } catch (e) {}
  }
}

// Load from Gist on startup
(async function init() {
  await reloadFromBlob();
  const count = Object.keys(devices).length;
  if (count > 0) console.log('[GIST] Loaded ' + count + ' devices from storage');
})();

// Directly read a single device from Gist without touching in-memory cache
async function readDeviceFromBlob(id) {
  const files = await getGistData();
  if (files && files['devices-data.json']) {
    try {
      const data = JSON.parse(files['devices-data.json'].content);
      return (data && data.devices && data.devices[id]) || null;
    } catch (e) {}
  }
  return null;
}

// Persist current state to Gist
function persistToBlob() {
  if (!GIST_ID || !GITHUB_TOKEN) return Promise.resolve();
  return patchGistFiles({
    'devices-data.json': {
      content: JSON.stringify({ devices }, null, 2)
    }
  });
}

function getAll() {
  return devices;
}

function getDevice(id) {
  return devices[id] || null;
}

// In-memory status update — only patches Gist on structural changes (new device, name/secret change)
async function upsertDevice(id, data) {
  const isNew = !devices[id];
  if (isNew) {
    devices[id] = { id, firstSeen: Date.now() };
  }

  let structuralChange = isNew;
  for (const k in data) {
    if (k !== 'lastSeen' && k !== 'status' && devices[id][k] !== data[k]) {
      structuralChange = true;
      break;
    }
  }

  Object.assign(devices[id], data, { lastSeen: Date.now() });

  if (structuralChange) {
    await persistToBlob().catch(() => {});
  }
  return devices[id];
}

// Set a pending command for a device
async function setDeviceCommand(deviceId, command) {
  pendingCommands[deviceId] = command;
  const fileName = `cmd-${deviceId}.json`;
  await patchGistFiles({
    [fileName]: {
      content: JSON.stringify({ command, ts: Date.now() })
    }
  });
}

// Get and clear a pending command for a device
async function getAndClearDeviceCommand(deviceId) {
  const fileName = `cmd-${deviceId}.json`;

  // 1. FIRST: check in-memory cache
  if (pendingCommands[deviceId] != null) {
    const cmd = pendingCommands[deviceId];
    delete pendingCommands[deviceId];
    // Delete command file from Gist to prevent duplicate cross-instance delivery
    await patchGistFiles({ [fileName]: null }).catch(() => {});
    return cmd;
  }

  // 2. SECOND: check dedicated Gist file (cross-instance delivery)
  const files = await getGistData();
  if (files && files[fileName] && files[fileName].content) {
    try {
      const data = JSON.parse(files[fileName].content);
      if (data && data.command != null) {
        const cmd = data.command;
        // Delete command file from Gist immediately upon consumption
        await patchGistFiles({ [fileName]: null }).catch(() => {});
        return cmd;
      }
    } catch (e) {}
  }

  return null;
}

function getAllDevices() {
  return Object.values(devices);
}

function getOnlineCount(timeoutMs = 180000) {
  const now = Date.now();
  let online = 0, offline = 0;
  for (const d of Object.values(devices)) {
    if (now - d.lastSeen < timeoutMs) online++;
    else offline++;
  }
  return { online, offline, total: Object.keys(devices).length };
}

async function renameDevice(id, name) {
  if (devices[id]) {
    devices[id].name = name;
    await persistToBlob();
    return true;
  }
  return false;
}

function verifyDeviceSecret(id, secret) {
  if (!devices[id]) return false;
  if (!devices[id].deviceSecret) return true;
  return devices[id].deviceSecret === secret;
}

async function setDeviceSecret(id, secret) {
  if (devices[id]) {
    devices[id].deviceSecret = secret;
    await persistToBlob();
    return true;
  }
  return false;
}

module.exports = {
  getAll,
  getDevice,
  upsertDevice,
  setDeviceCommand,
  getAndClearDeviceCommand,
  getAllDevices,
  getOnlineCount,
  reloadFromBlob,
  renameDevice,
  verifyDeviceSecret,
  setDeviceSecret,
  readDeviceFromBlob,
};
