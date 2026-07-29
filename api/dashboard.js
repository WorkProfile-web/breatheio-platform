/**
 * GET /api/dashboard
 * Serves the BreatheIO dashboard with embedded device data.
 */
const store = require('./_store');

module.exports = async (req, res) => {
  // Build device data from store
  const now = Date.now();
  const allDevices = store.getAllDevices();
  const devicesJson = JSON.stringify(allDevices.map(d => ({
    id: d.id,
    name: d.name,
    status: (now - d.lastSeen) < 180000 ? 'online' : 'offline',
    lastSeen: d.lastSeen,
    firstSeen: d.firstSeen,
    ip: d.ip
  })));

  const hasDevices = allDevices.length > 0;

  // Build device cards HTML server-side
  let cardsHtml = '';
  if (!hasDevices) {
    cardsHtml = '<div class="empty-state"><h2>No devices yet</h2><p>Power on your ESP32 devices and they\'ll appear here automatically.</p><p style="margin-top:8px;font-size:12px;color:#4444aa">Each device registers itself using its unique chip ID.</p></div>';
  } else {
    const sorted = [...allDevices].sort((a, b) => {
      const aOnline = (now - a.lastSeen) < 180000;
      const bOnline = (now - b.lastSeen) < 180000;
      if (aOnline && !bOnline) return -1;
      if (!aOnline && bOnline) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });

    for (const d of sorted) {
      const online = (now - d.lastSeen) < 180000;
      const cls = online ? 'online' : 'offline';
      const lastSeen = timeAgo(now, d.lastSeen);
      cardsHtml += '<div class="device-card ' + cls + '">';
      cardsHtml += '<div class="device-info">';
      cardsHtml += '<div class="device-name">' + esc(d.name || ('ESP32-' + d.id.substring(0, 6))) + '</div>';
      cardsHtml += '<div class="device-id">ID: ' + esc(d.id) + '</div>';
      cardsHtml += '<div class="device-status"><span class="dot ' + cls + '"></span>' + (online ? 'online' : 'offline') + ' <span class="last-seen">&bull; ' + lastSeen + '</span></div>';
      cardsHtml += '</div>';
      cardsHtml += '<div class="device-actions">';
      cardsHtml += '<button class="btn btn-ping" data-id="' + d.id + '" data-action="ping">Ping</button>';
      cardsHtml += '<button class="btn btn-restart" data-id="' + d.id + '" data-action="restart">Restart</button>';
      cardsHtml += '<button class="btn btn-led-on" data-id="' + d.id + '" data-action="led_on">LED ON</button>';
      cardsHtml += '<button class="btn btn-led-off" data-id="' + d.id + '" data-action="led_off">LED OFF</button>';
      cardsHtml += '</div></div>';
    }
  }

  const html = '<!DOCTYPE html>' +
'<html lang="en">' +
'<head>' +
'<meta charset="UTF-8">' +
'<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
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
'</style>' +
'</head><body>' +
'<div class="header">' +
'<div><h1>BreatheIO Platform</h1><div class="subtitle">Your ESP32 devices, anywhere</div></div>' +
'<div class="stats">' +
  '<div class="stat online"><div class="num" id="countOnline">' + allDevices.filter(d => (now - d.lastSeen) < 180000).length + '</div><div class="label">Online</div></div>' +
  '<div class="stat offline"><div class="num" id="countOffline">' + allDevices.filter(d => (now - d.lastSeen) >= 180000).length + '</div><div class="label">Offline</div></div>' +
  '<div class="stat total"><div class="num" id="countTotal">' + allDevices.length + '</div><div class="label">Total</div></div>' +
'</div></div>' +
'<div class="container" id="devicesContainer">' + cardsHtml + '</div>' +
'<div class="toast" id="toast"></div>' +
'<script>' +
'var devices=' + devicesJson + ';' +
'var container=document.getElementById("devicesContainer");' +
'var toast=document.getElementById("toast");' +
'var toastTimeout;' +
'function showToast(msg,err){clearTimeout(toastTimeout);toast.textContent=msg;toast.style.borderColor=err?"#ff5252":"#2a2a4a";toast.classList.add("show");toastTimeout=setTimeout(function(){toast.classList.remove("show")},3000)}' +
'document.addEventListener("click",function(e){' +
  'var btn=e.target.closest(".btn");' +
  'if(!btn)return;' +
  'var id=btn.getAttribute("data-id");' +
  'var action=btn.getAttribute("data-action");' +
  'fetch("/api/command",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({deviceId:id,action})})' +
  '.then(function(r){return r.json()})' +
  '.then(function(d){if(d.success){showToast("Sent "+action+" to "+id.slice(0,6)+"...")}else{showToast("Error: "+d.error,true)}})' +
  '.catch(function(){showToast("Network error",true)});' +
'})' +
'function render(d){' +
  'var online=0,offline=0,html="";' +
  'd.sort(function(a,b){var ao=(Date.now()-a.lastSeen)<180000,bo=(Date.now()-b.lastSeen)<180000;if(ao&&!bo)return-1;if(!ao&&bo)return 1;return(a.name||"").localeCompare(b.name||"")});' +
  'for(var i=0;i<d.length;i++){' +
    'var dv=d[i],on=(Date.now()-dv.lastSeen)<180000,cls=on?"online":"offline";' +
    'online+=on?1:0;offline+=on?0:1;' +
    'html+="<div class=\\"device-card "+cls+"\\"><div class=\\"device-info\\"><div class=\\"device-name\\">"+esc(dv.name)+"</div><div class=\\"device-id\\">ID: "+esc(dv.id)+"</div><div class=\\"device-status\\"><span class=\\"dot "+cls+"\\"></span>"+cls+" <span class=\\"last-seen\\">&bull; "+ago(dv.lastSeen)+"</span></div></div><div class=\\"device-actions\\"><button class=\\"btn btn-ping\\" data-id=\\""+dv.id+"\\" data-action=\\"ping\\">Ping</button><button class=\\"btn btn-restart\\" data-id=\\""+dv.id+"\\" data-action=\\"restart\\">Restart</button><button class=\\"btn btn-led-on\\" data-id=\\""+dv.id+"\\" data-action=\\"led_on\\">LED ON</button><button class=\\"btn btn-led-off\\" data-id=\\""+dv.id+"\\" data-action=\\"led_off\\">LED OFF</button></div></div>";' +
  '}' +
  'if(d.length===0){html="<div class=\\"empty-state\\"><h2>No devices yet</h2><p>Power on your ESP32 devices and they&apos;ll appear here automatically.</p><p style=\\"margin-top:8px;font-size:12px;color:#4444aa\\">Each device registers itself using its unique chip ID.</p></div>"}' +
  'document.getElementById("countOnline").textContent=online;' +
  'document.getElementById("countOffline").textContent=offline;' +
  'document.getElementById("countTotal").textContent=d.length;' +
  'container.innerHTML=html' +
'}' +
'function ago(t){var s=Math.floor((Date.now()-t)/1000);if(s<5)return"just now";if(s<60)return s+"s ago";var m=Math.floor(s/60);if(m<60)return m+"m ago";return Math.floor(m/60)+"h ago"}' +
'function esc(s){var d=document.createElement("div");d.textContent=s;return d.innerHTML}' +
'fetch("/api/devices").then(function(r){return r.json()}).then(function(d){if(d.devices){render(d.devices)}}).catch(function(){})' +
'setInterval(function(){fetch("/api/devices").then(function(r){return r.json()}).then(function(d){if(d.devices){render(d.devices)}}).catch(function(){})},5000);' +
'</script>' +
'</body></html>';

  try {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Dashboard error: ' + err.message);
  }
};

// Helper: format time ago
function timeAgo(now, t) {
  if (!t) return 'never';
  const s = Math.floor((now - t) / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return s + 's ago';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm ago';
  return Math.floor(m / 60) + 'h ago';
}

// Helper: escape HTML
function esc(s) {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
