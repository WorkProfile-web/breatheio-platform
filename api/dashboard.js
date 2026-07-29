/**
 * GET /api/dashboard
 * Serves the BreatheIO device management dashboard.
 * Shows all registered ESP32 devices with their status.
 */
module.exports = async (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BreatheIO - Device Dashboard</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #0f0f1a;
    color: #e0e0e0;
    min-height: 100vh;
  }
  .header {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    padding: 20px 30px;
    border-bottom: 1px solid #2a2a4a;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 15px;
  }
  .header h1 {
    font-size: 24px;
    background: linear-gradient(90deg, #00e676, #00bcd4);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .header .subtitle {
    color: #8888aa;
    font-size: 14px;
  }
  .stats {
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
  }
  .stat {
    text-align: center;
    padding: 8px 16px;
    background: rgba(255,255,255,0.05);
    border-radius: 8px;
    min-width: 80px;
  }
  .stat .num { font-size: 22px; font-weight: bold; }
  .stat .label { font-size: 11px; color: #8888aa; text-transform: uppercase; }
  .stat.online .num { color: #00e676; }
  .stat.offline .num { color: #ff5252; }
  .stat.total .num { color: #82b1ff; }
  .container { max-width: 900px; margin: 30px auto; padding: 0 20px; }
  .device-card {
    background: #1a1a2e;
    border: 1px solid #2a2a4a;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    transition: all 0.2s;
  }
  .device-card:hover { border-color: #3a3a6a; background: #1e1e35; }
  .device-card.online { border-left: 4px solid #00e676; }
  .device-card.offline { border-left: 4px solid #ff5252; opacity: 0.6; }
  .device-info { display: flex; flex-direction: column; gap: 4px; }
  .device-name { font-size: 16px; font-weight: 600; color: #fff; }
  .device-id { font-size: 12px; color: #6666aa; font-family: monospace; }
  .device-status {
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .device-status .dot {
    width: 8px; height: 8px; border-radius: 50%; display: inline-block;
  }
  .device-status .dot.online { background: #00e676; box-shadow: 0 0 6px #00e67688; }
  .device-status .dot.offline { background: #ff5252; }
  .device-actions { display: flex; gap: 8px; flex-wrap: wrap; }
  .btn {
    padding: 8px 16px;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    color: #fff;
  }
  .btn:active { transform: scale(0.95); }
  .btn-ping { background: #3949ab; }
  .btn-ping:hover { background: #5c6bc0; }
  .btn-restart { background: #e53935; }
  .btn-restart:hover { background: #ef5350; }
  .btn-led-on { background: #2e7d32; }
  .btn-led-on:hover { background: #43a047; }
  .btn-led-off { background: #6d4c41; }
  .btn-led-off:hover { background: #8d6e63; }
  .empty-state {
    text-align: center;
    padding: 80px 20px;
    color: #6666aa;
  }
  .empty-state h2 { font-size: 22px; margin-bottom: 10px; color: #8888bb; }
  .empty-state p { font-size: 14px; line-height: 1.6; }
  .toast {
    position: fixed; bottom: 30px; right: 30px;
    background: #1a1a2e; border: 1px solid #2a2a4a;
    padding: 14px 24px; border-radius: 10px;
    font-size: 14px; display: none;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    z-index: 100;
  }
  .toast.show { display: block; animation: slideIn 0.3s; }
  @keyframes slideIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  .last-seen { font-size: 12px; color: #5555aa; }
  @media (max-width: 600px) {
    .header { padding: 15px; }
    .device-card { flex-direction: column; align-items: flex-start; }
    .device-actions { width: 100%; justify-content: flex-start; }
  }
</style>
</head>
<body>
<div class="header">
  <div>
    <h1>BreatheIO Platform</h1>
    <div class="subtitle">Your ESP32 devices, anywhere in the world</div>
  </div>
  <div class="stats" id="stats">
    <div class="stat online"><div class="num" id="countOnline">0</div><div class="label">Online</div></div>
    <div class="stat offline"><div class="num" id="countOffline">0</div><div class="label">Offline</div></div>
    <div class="stat total"><div class="num" id="countTotal">0</div><div class="label">Total</div></div>
  </div>
</div>
<div class="container" id="devicesContainer">
  <div class="empty-state">
    <h2>No devices yet</h2>
    <p>Power on your ESP32 devices and they'll appear here automatically.</p>
    <p style="margin-top:8px;font-size:12px;color:#4444aa">Each device registers itself using its unique chip ID.</p>
  </div>
</div>
<div class="toast" id="toast"></div>

<script>
const API = '';
const container = document.getElementById('devicesContainer');
const toast = document.getElementById('toast');
let toastTimeout;

function showToast(msg, isError) {
  clearTimeout(toastTimeout);
  toast.textContent = msg;
  toast.style.borderColor = isError ? '#ff5252' : '#2a2a4a';
  toast.classList.add('show');
  toastTimeout = setTimeout(() => toast.classList.remove('show'), 3000);
}

async function sendCmd(deviceId, action) {
  try {
    const res = await fetch(API + '/api/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, action })
    });
    const data = await res.json();
    if (data.success) showToast('Command "${action}" sent to ' + deviceId.substring(0,6) + '...');
    else showToast('Error: ' + (data.error || 'Unknown'), true);
  } catch(e) { showToast('Network error', true); }
}

async function loadDevices() {
  try {
    const res = await fetch(API + '/api/devices');
    const data = await res.json();
    const devices = data.devices || [];

    const online = devices.filter(d => d.status === 'online').length;
    const offline = devices.filter(d => d.status === 'offline').length;
    document.getElementById('countOnline').textContent = online;
    document.getElementById('countOffline').textContent = offline;
    document.getElementById('countTotal').textContent = devices.length;

    if (devices.length === 0) {
      container.innerHTML = '<div class="empty-state"><h2>No devices yet</h2><p>Power on your ESP32 devices and they\\'ll appear here automatically.</p><p style="margin-top:8px;font-size:12px;color:#4444aa">Each device registers itself using its unique chip ID.</p></div>';
      return;
    }

    let html = '';
    for (const d of devices) {
      const lastSeen = d.lastSeen ? timeAgo(d.lastSeen) : 'never';
      const statusClass = d.status === 'online' ? 'online' : 'offline';
      html += '<div class="device-card ' + statusClass + '">';
      html += '<div class="device-info">';
      html += '<div class="device-name">' + escapeHtml(d.name) + '</div>';
      html += '<div class="device-id">ID: ' + escapeHtml(d.id) + '</div>';
      html += '<div class="device-status"><span class="dot ' + statusClass + '"></span>' + d.status + ' <span class="last-seen">\\u2022 ' + lastSeen + '</span></div>';
      html += '</div>';
      html += '<div class="device-actions">';
      html += '<button class="btn btn-ping" onclick="sendCmd(\\'' + d.id + '\\',\\'ping\\')">Ping</button>';
      html += '<button class="btn btn-restart" onclick="sendCmd(\\'' + d.id + '\\',\\'restart\\')">Restart</button>';
      html += '<button class="btn btn-led-on" onclick="sendCmd(\\'' + d.id + '\\',\\'led_on\\')">LED ON</button>';
      html += '<button class="btn btn-led-off" onclick="sendCmd(\\'' + d.id + '\\',\\'led_off\\')">LED OFF</button>';
      html += '</div></div>';
    }
    container.innerHTML = html;
  } catch(e) {
    console.error(e);
  }
}

function timeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  const sec = Math.floor(diff / 1000);
  if (sec < 5) return 'just now';
  if (sec < 60) return sec + 's ago';
  const min = Math.floor(sec / 60);
  if (min < 60) return min + 'm ago';
  const hr = Math.floor(min / 60);
  return hr + 'h ago';
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// Refresh every 5 seconds
loadDevices();
setInterval(loadDevices, 5000);
</script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
};
