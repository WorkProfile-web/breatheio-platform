/**
 * Vercel Blob device storage.
 * 
 * In-memory cache backed by Vercel Blob for persistence across instances.
 * No new accounts. No credit cards. Uses your existing Vercel Storage.
 * 
 * On writes -> updates memory cache + persists to Blob.
 * On reads -> instant from memory cache.
 * On cold start -> loads from Blob in background.
 */

const { put, head, del } = require('@vercel/blob');

const BLOB_PATH = 'devices-data.json';

// In-memory cache
let devices = {};

// Reload devices from Vercel Blob into the in-memory cache
async function reloadFromBlob() {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.log('[BLOB] reloadFromBlob: NO TOKEN');
      return;
    }
    const info = await head(BLOB_PATH).catch(err => {
      console.log('[BLOB] head() failed:', err.message);
      return null;
    });
    if (!info) {
      console.log('[BLOB] reloadFromBlob: head returned null, blob may not exist yet');
      return;
    }
    console.log('[BLOB] head() OK, url length:', info.url.length);
    const cacheBusterUrl = info.url + (info.url.includes('?') ? '&' : '?') + 't=' + Date.now();
    const resp = await fetch(cacheBusterUrl, {
      headers: { Authorization: 'Bearer ' + process.env.BLOB_READ_WRITE_TOKEN },
      cache: 'no-store'
    });
    console.log('[BLOB] fetch status:', resp.status, resp.statusText);
    if (resp.ok) {
      const data = await resp.json();
      const count = data && data.devices ? Object.keys(data.devices).length : 0;
      console.log('[BLOB] Loaded', count, 'devices from storage');
      if (data && data.devices) {
        devices = data.devices;
      }
    } else {
      console.log('[BLOB] fetch NOT OK:', resp.status, resp.statusText);
    }
  } catch (e) {
    console.log('[BLOB] reloadFromBlob ERROR:', e.message);
  }
}

// Load from Vercel Blob on startup
(async function init() {
  await reloadFromBlob();
  const count = Object.keys(devices).length;
  if (count > 0) console.log('[BLOB] Loaded ' + count + ' devices from storage');
})();

// Directly read a single device from Blob without touching the in-memory cache
// Used as a fallback when reloadFromBlob() fails on cold start
async function readDeviceFromBlob(id) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
    const info = await head(BLOB_PATH).catch(() => null);
    if (!info) return null;
    const cacheBusterUrl = info.url + (info.url.includes('?') ? '&' : '?') + 't=' + Date.now();
    const resp = await fetch(cacheBusterUrl, {
      headers: { Authorization: 'Bearer ' + process.env.BLOB_READ_WRITE_TOKEN },
      cache: 'no-store'
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data && data.devices && data.devices[id]) {
      return data.devices[id];
    }
  } catch (e) {
    console.log('[BLOB] readDeviceFromBlob error:', e.message);
  }
  return null;
}

// Persist current state to Blob — returns promise so callers can await completion
// Throws on failure so callers know the write didn't go through
function persistToBlob() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return Promise.resolve();
  return put(BLOB_PATH, JSON.stringify({ devices }), {
    access: 'private',
    contentType: 'application/json',
    cacheControlMaxAge: 0,
    addRandomSuffix: false,
    allowOverwrite: true,
  }).catch(err => {
    console.error('[BLOB] Write FAILED:', err.message);
    throw err;  // Propagate so callers know the write didn't succeed
  });
}

function getAll() {
  return devices;
}

function getDevice(id) {
  return devices[id] || null;
}

async function upsertDevice(id, data) {
  if (!devices[id]) {
    devices[id] = { id, firstSeen: Date.now() };
  }
  Object.assign(devices[id], data, { lastSeen: Date.now() });
  await persistToBlob();
  return devices[id];
}

// ============================================================
// SEPARATE command storage — NOT in devices-data.json
// Uses dedicated Blob files (cmd-{deviceId}.json) per device
// This prevents device status updates from overwriting commands
// ============================================================

// In-memory command cache (separate from devices)
let pendingCommands = {};

// Set a pending command for a device
async function setDeviceCommand(deviceId, command) {
  pendingCommands[deviceId] = command;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const cmdPath = 'cmd-' + deviceId + '.json';
    await put(cmdPath, JSON.stringify({ command, ts: Date.now() }), {
      access: 'private',
      contentType: 'application/json',
      cacheControlMaxAge: 0,
      addRandomSuffix: false,
      allowOverwrite: true,
    }).catch(err => {
      console.error('[CMD] Write FAILED:', err.message);
      throw err;
    });
  }
}

// Get and clear a pending command for a device
async function getAndClearDeviceCommand(deviceId) {
  // FIRST: check in-memory cache
  if (pendingCommands[deviceId] != null) {
    const cmd = pendingCommands[deviceId];
    delete pendingCommands[deviceId];
    // Delete Blob file to prevent cross-instance duplicate delivery
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const cmdPath = 'cmd-' + deviceId + '.json';
      const info = await head(cmdPath).catch(() => null);
      if (info) {
        await del(info.url).catch(() => {});
      }
    }
    return cmd;
  }

  // SECOND: check dedicated Blob file (for cross-instance delivery)
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const cmdPath = 'cmd-' + deviceId + '.json';
      const info = await head(cmdPath).catch(() => null);
      if (info) {
        const cacheBusterUrl = info.url + (info.url.includes('?') ? '&' : '?') + 't=' + Date.now();
        const resp = await fetch(cacheBusterUrl, {
          headers: { Authorization: 'Bearer ' + process.env.BLOB_READ_WRITE_TOKEN },
          cache: 'no-store'
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data && data.command != null) {
            const cmd = data.command;
            // Delete blob file instantly upon consumption to avoid CDN duplicates
            await del(info.url).catch(() => {});
            return cmd;
          }
        }
      }
    } catch (e) {
      console.log('[CMD] Blob read error:', e.message);
    }
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
  if (!devices[id].deviceSecret) return true; // No secret set = legacy device, allow
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
