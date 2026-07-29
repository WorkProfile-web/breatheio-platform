/**
 * In-memory device storage.
 * 
 * No API keys. No databases. No bullshit.
 * 
 * Data persists as long as the serverless function stays warm.
 * Heartbeats every 60s keep it warm. On cold start, devices
 * re-register on their next heartbeat automatically.
 */

// Global device store (shared across all instances)
const devices = {};

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
  return devices[id];
}

function setPendingCommand(id, command) {
  if (devices[id]) {
    devices[id].pendingCommand = command;
    return true;
  }
  return false;
}

function getAndClearPendingCommand(id) {
  if (devices[id] && devices[id].pendingCommand != null) {
    const cmd = devices[id].pendingCommand;
    devices[id].pendingCommand = null;
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
