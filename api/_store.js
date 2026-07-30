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

// Reload devices from Vercel Blob into the in-memory cache
async function reloadFromBlob() {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) return;
    const info = await head(BLOB_PATH).catch(() => null);
    if (!info) return;
    const resp = await fetch(info.url, {
      headers: { Authorization: 'Bearer ' + process.env.BLOB_READ_WRITE_TOKEN }
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data && data.devices) {
        devices = data.devices;
      }
    }
  } catch (e) {
    // Blob doesn't exist yet or error — start fresh
  }
}

// Load from Vercel Blob on startup
(async function init() {
  await reloadFromBlob();
  const count = Object.keys(devices).length;
  if (count > 0) console.log('[BLOB] Loaded ' + count + ' devices from storage');
})();

// Persist current state to Blob — returns promise so callers can await completion
// Throws on failure so callers know the write didn't go through
function persistToBlob() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return Promise.resolve();
  return put(BLOB_PATH, JSON.stringify({ devices }), {
    access: 'private',
    contentType: 'application/json',
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

async function setPendingCommand(id, command) {
  if (devices[id]) {
    devices[id].pendingCommand = command;
    await persistToBlob();
    return true;
  }
  return false;
}

async function getAndClearPendingCommand(id) {
  // Reload from Blob first — ensures commands sent from other instances are picked up
  await reloadFromBlob();

  if (devices[id] && devices[id].pendingCommand != null) {
    const cmd = devices[id].pendingCommand;
    devices[id].pendingCommand = null;
    await persistToBlob();
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
  setPendingCommand,
  getAndClearPendingCommand,
  getAllDevices,
  getOnlineCount,
  reloadFromBlob,
  renameDevice,
  verifyDeviceSecret,
  setDeviceSecret,
};
