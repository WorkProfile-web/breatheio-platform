/**
 * GET /api/dashboard
 * Serves device dashboard. Cards rendered server-side.
 * JS just handles buttons + polling stats.
 */
const store = require('./_store');

module.exports = async (req, res) => {
  const now = Date.now();
  const allDevices = store.getAllDevices();
  const devicesJson = JSON.stringify(allDevices.map(d => ({
    id: d.id, name: d.name,
    status: (now - d.lastSeen) < 180000 ? 'online' : 'offline',
    lastSeen: d.lastSeen, firstSeen: d.firstSeen, ip: d.ip
  })));

  // Build cards on server
  let cards = '';
  if (allDevices.length === 0) {
    cards = '<div class="empty-state"><h2>No devices yet</h2><p>Power on your ESP32 devices and they&apos;ll appear here automatically.</p><p style="margin-top:8px;font-size:12px;color:#4444aa">Each device registers itself using its unique chip ID.</p></div>';
  } else {
    const sorted = [...allDevices].sort((a, b) => {
      const aOn = (now - a.lastSeen) < 180000, bOn = (now - b.lastSeen) < 180000;
      if (aOn && !bOn) return -1;
      if (!aOn && bOn) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });
    for (const d of sorted) {
      const on = (now - d.lastSeen) < 180000;
      const cls = on ? 'online' : 'offline';
      const ls = d.lastSeen ? timeAgo(now, d.lastSeen) : 'never';
      cards += '<div class="device-card ' + cls + '">' +
        '<div class="device-info">' +
        '<div class="device-name">' + esc(d.name || ('ESP32-' + d.id.substring(0, 6))) + '</div>' +
        '<div class="device-id">ID: ' + esc(d.id) + '</div>' +
        '<div class="device-status"><span class="dot ' + cls + '"></span>' + (on ? 'online' : 'offline') + ' <span class="last-seen">&bull; ' + ls + '</span></div>' +
        '</div>' +
        '<div class="device-actions">' +
        '<button class="btn btn-ping" data-id="' + d.id + '" data-action="ping">Ping</button>' +
        '<button class="btn btn-restart" data-id="' + d.id + '" data-action="restart">Restart</button>' +
        '<button class="btn btn-led-on" data-id="' + d.id + '" data-action="led_on">LED ON</button>' +
        '<button class="btn btn-led-off" data-id="' + d.id + '" data-action="led_off">LED OFF</button>' +
        '</div></div>';
    }
  }

  const online = allDevices.filter(d => (now - d.lastSeen) < 180000).length;
  const offline = allDevices.length - online;

  const html = '<!DOCTYPE html>' +
'<html lang="en"><head>' +
'<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
'<title>BreatheIO - Device Dashboard</title>' +
'<style>' +
'*{margin:0;padding:0;box-sizing:border-box}' +
'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0f0f1a;color:#e0e0e0;min-height:100vh}' +
'.header{background:linear-gradient(135deg,#1a1a2e,#16213e);padding:20px 30px;border-bottom:1px solid #2a2a4a;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:15px}' +
'.header h1{font-size:24px;background:linear-gradient(90deg,#00e676,#00bcd4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}' +
'.header .subtitle{color:#8888aa;font-size:14px}' +
'.stats{display:flex;gap:20px;flex-wrap:wrap}' +
'.stat{text-align:center;padding:8px 16px;background:rgba(255,255,255,0.05);border-radius:8px;min-width:80px}' +
'.stat .num{font-size:22px;font-weight:bold}' +
'.stat .label{font-size:11px;color:#8888aa;text-transform:uppercase}' +
'.stat.online .num{color:#00e676}' +
'.stat.offline .num{color:#ff5252}' +
'.stat.total .num{color:#82b1ff}' +
'.container{max-width:900px;margin:30px auto;padding:0 20px}' +
'.device-card{background:#1a1a2e;border:1px solid #2a2a4a;border-radius:12px;padding:20px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;transition:all .2s}' +
'.device-card:hover{border-color:#3a3a6a;background:#1e1e35}' +
'.device-card.online{border-left:4px solid #00e676}' +
'.device-card.offline{border-left:4px solid #ff5252;opacity:.6}' +
'.device-info{display:flex;flex-direction:column;gap:4px}' +
'.device-name{font-size:16px;font-weight:600;color:#fff}' +
'.device-id{font-size:12px;color:#6666aa;font-family:monospace}' +
'.device-status{font-size:13px;display:flex;align-items:center;gap:6px}' +
'.device-status .dot{width:8px;height:8px;border-radius:50%;display:inline-block}' +
'.device-status .dot.online{background:#00e676;box-shadow:0 0 6px #00e67688}' +
'.device-status .dot.offline{background:#ff5252}' +
'.device-actions{display:flex;gap:8px;flex-wrap:wrap}' +
'.btn{padding:8px 16px;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;transition:all .15s;color:#fff}' +
'.btn:active{transform:scale(.95)}' +
'.btn-ping{background:#3949ab}.btn-ping:hover{background:#5c6bc0}' +
'.btn-restart{background:#e53935}.btn-restart:hover{background:#ef5350}' +
'.btn-led-on{background:#2e7d32}.btn-led-on:hover{background:#43a047}' +
'.btn-led-off{background:#6d4c41}.btn-led-off:hover{background:#8d6e63}' +
'.empty-state{text-align:center;padding:80px 20px;color:#6666aa}' +
'.empty-state h2{font-size:22px;margin-bottom:10px;color:#8888bb}' +
'.empty-state p{font-size:14px;line-height:1.6}' +
'.toast{position:fixed;bottom:30px;right:30px;background:#1a1a2e;border:1px solid #2a2a4a;padding:14px 24px;border-radius:10px;font-size:14px;display:none;box-shadow:0 8px 32px rgba(0,0,0,.4);z-index:100}' +
'.toast.show{display:block;animation:slideIn .3s}' +
'@keyframes slideIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}' +
'.last-seen{font-size:12px;color:#5555aa}' +
'@media(max-width:600px){.header{padding:15px}.device-card{flex-direction:column;align-items:flex-start}.device-actions{width:100%;justify-content:flex-start}}' +
'</style></head><body>' +
'<div class="header">' +
'<div><h1>BreatheIO Platform</h1><div class="subtitle">Your ESP32 devices, anywhere</div></div>' +
'<div class="stats"><div class="stat online"><div class="num" id="nOnline">' + online + '</div><div class="label">Online</div></div>' +
'<div class="stat offline"><div class="num" id="nOffline">' + offline + '</div><div class="label">Offline</div></div>' +
'<div class="stat total"><div class="num" id="nTotal">' + allDevices.length + '</div><div class="label">Total</div></div></div></div>' +
'<div class="container" id="devicesContainer">' + cards + '</div>' +
'<div class="toast" id="toast"></div>' +
'<script>' +
'(function(){' +
'var con=document.getElementById("devicesContainer");' +
'var to=document.getElementById("toast");' +
'var tt;' +
'function sm(m,e){clearTimeout(tt);to.textContent=m;to.style.borderColor=e?"#ff5252":"#2a2a4a";to.classList.add("show");tt=setTimeout(function(){to.classList.remove("show")},3000)}' +
'document.addEventListener("click",function(e){' +
'var b=e.target.closest(".btn");' +
'if(!b)return;' +
'var id=b.getAttribute("data-id");' +
'var ac=b.getAttribute("data-action");' +
'var x=new XMLHttpRequest();' +
'x.open("POST","/api/command");' +
'x.setRequestHeader("Content-Type","application/json");' +
'x.onload=function(){try{var d=JSON.parse(x.responseText);if(d.success){sm("Sent "+ac+" to "+id.slice(0,6)+"...")}else{sm("Error: "+d.error,true)}}catch(e){sm("Error",true)}};' +
'x.onerror=function(){sm("Network error",true)};' +
'x.send(JSON.stringify({deviceId:id,action:ac}))' +
'});' +
'setInterval(function(){' +
'var x=new XMLHttpRequest();' +
'x.open("GET","/api/devices");' +
'x.onload=function(){try{var d=JSON.parse(x.responseText);if(!d.devices||d.devices.length===0)return;' +
'var on=0,off=0;' +
'for(var i=0;i<d.devices.length;i++){if((Date.now()-d.devices[i].lastSeen)<180000)on++;else off++}' +
'document.getElementById("nOnline").textContent=on;' +
'document.getElementById("nOffline").textContent=off;' +
'document.getElementById("nTotal").textContent=d.devices.length' +
'}catch(e){}};x.send()},5000);' +
'})();' +
'</script></body></html>';

  try {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Dashboard error: ' + err.message);
  }
};

function timeAgo(now, t) {
  if (!t) return 'never';
  const s = Math.floor((now - t) / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return s + 's ago';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm ago';
  return Math.floor(m / 60) + 'h ago';
}

function esc(s) {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
