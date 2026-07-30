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

const { put, head } = require('@vercel/blob');

const BLOB_PATH = 'devices-data.json';

// In-memory cache
let devices = {};

// Load from Vercel Blob on startup
(async function init() {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) return;
    const info = await head(BLOB_PATH).catch(() => null);
    if (!info) return;
    const resp = await fetch(info.url);
    if (resp.ok) {
      const data = await resp.json();
      if (data && data.devices) {
        devices = data.devices;
        console.log('[BLOB] Loaded ' + Object.keys(devices).length + ' devices from storage');
      }
    }
  } catch (e) {
    // Blob doesn't exist yet or error — start fresh
  }
})();

// Persist current state to Blob (fire-and-forget)
function persistToBlob() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  put(BLOB_PATH, JSON.stringify({ devices }), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
  }).catch(() => {});
}

function getAll() {
  return devices;
}

function getDevice(id) {
  return devices[id] || null;
}

function upsertDevice(id, data) {
  if (!devices[id]) {
    devices[id] = { id, firstSeen: Date.now() };
  }
  Object.assign(devices[id], data, { lastSeen: Date.now() });
  persistToBlob();
  return devices[id];
}

function setPendingCommand(id, command) {
  if (devices[id]) {
    devices[id].pendingCommand = command;
    persistToBlob();
    return true;
  }
  return false;
}

function getAndClearPendingCommand(id) {
  if (devices[id] && devices[id].pendingCommand != null) {
    const cmd = devices[id].pendingCommand;
    devices[id].pendingCommand = null;
    persistToBlob();
    return cmd;
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

module.exports = {
  getAll,
  getDevice,
  upsertDevice,
  setPendingCommand,
  getAndClearPendingCommand,
  getAllDevices,
  getOnlineCount
};
