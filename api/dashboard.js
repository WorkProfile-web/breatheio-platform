/**
 * GET /api/dashboard
 * Serves the BreatheIO device management dashboard page.
 */
module.exports = async (req, res) => {
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
'.device-card{background:#1a1a2e;border:1px solid #2a2a4a;border-radius:12px;padding:20px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;transition:all 0.2s}' +
'.device-card:hover{border-color:#3a3a6a;background:#1e1e35}' +
'.device-card.online{border-left:4px solid #00e676}' +
'.device-card.offline{border-left:4px solid #ff5252;opacity:0.6}' +
'.device-info{display:flex;flex-direction:column;gap:4px}' +
'.device-name{font-size:16px;font-weight:600;color:#fff}' +
'.device-id{font-size:12px;color:#6666aa;font-family:monospace}' +
'.device-status{font-size:13px;display:flex;align-items:center;gap:6px}' +
'.device-status .dot{width:8px;height:8px;border-radius:50%;display:inline-block}' +
'.device-status .dot.online{background:#00e676;box-shadow:0 0 6px #00e67688}' +
'.device-status .dot.offline{background:#ff5252}' +
'.device-actions{display:flex;gap:8px;flex-wrap:wrap}' +
'.btn{padding:8px 16px;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;transition:all 0.15s;color:#fff}' +
'.btn:active{transform:scale(0.95)}' +
'.btn-ping{background:#3949ab}' +
'.btn-ping:hover{background:#5c6bc0}' +
'.btn-restart{background:#e53935}' +
'.btn-restart:hover{background:#ef5350}' +
'.btn-led-on{background:#2e7d32}' +
'.btn-led-on:hover{background:#43a047}' +
'.btn-led-off{background:#6d4c41}' +
'.btn-led-off:hover{background:#8d6e63}' +
'.empty-state{text-align:center;padding:80px 20px;color:#6666aa}' +
'.empty-state h2{font-size:22px;margin-bottom:10px;color:#8888bb}' +
'.empty-state p{font-size:14px;line-height:1.6}' +
'.toast{position:fixed;bottom:30px;right:30px;background:#1a1a2e;border:1px solid #2a2a4a;padding:14px 24px;border-radius:10px;font-size:14px;display:none;box-shadow:0 8px 32px rgba(0,0,0,0.4);z-index:100}' +
'.toast.show{display:block;animation:slideIn 0.3s}' +
'@keyframes slideIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}' +
'.last-seen{font-size:12px;color:#5555aa}' +
'@media(max-width:600px){.header{padding:15px}.device-card{flex-direction:column;align-items:flex-start}.device-actions{width:100%;justify-content:flex-start}}' +
'</style>' +
'</head>' +
'<body>' +
'<div class="header">' +
  '<div>' +
    '<h1>BreatheIO Platform</h1>' +
    '<div class="subtitle">Your ESP32 devices, anywhere in the world</div>' +
  '</div>' +
  '<div class="stats" id="stats">' +
    '<div class="stat online"><div class="num" id="countOnline">0</div><div class="label">Online</div></div>' +
    '<div class="stat offline"><div class="num" id="countOffline">0</div><div class="label">Offline</div></div>' +
    '<div class="stat total"><div class="num" id="countTotal">0</div><div class="label">Total</div></div>' +
  '</div>' +
'</div>' +
'<div class="container" id="devicesContainer">' +
  '<div class="empty-state">' +
    '<h2>No devices yet</h2>' +
    '<p>Power on your ESP32 devices and they&apos;ll appear here automatically.</p>' +
    '<p style="margin-top:8px;font-size:12px;color:#4444aa">Each device registers itself using its unique chip ID.</p>' +
  '</div>' +
'</div>' +
'<div class="toast" id="toast"></div>' +
'<script>' +
'const API="";' +
'const container=document.getElementById("devicesContainer");' +
'const toast=document.getElementById("toast");' +
'let toastTimeout;' +
'function showToast(msg,isError){clearTimeout(toastTimeout);toast.textContent=msg;toast.style.borderColor=isError?"#ff5252":"#2a2a4a";toast.classList.add("show");toastTimeout=setTimeout(()=>toast.classList.remove("show"),3000)}' +
'async function sendCmd(id,action){try{const r=await fetch(API+"/api/command",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({deviceId:id,action})});const d=await r.json();if(d.success){showToast("Command sent to "+id.slice(0,6)+"...")}else{showToast("Error: "+(d.error||"Unknown"),true)}}catch(e){showToast("Network error",true)}}' +
'async function loadDevices(){try{const r=await fetch(API+"/api/devices");const d=await r.json();const devices=d.devices||[];document.getElementById("countOnline").textContent=devices.filter(x=>x.status==="online").length;document.getElementById("countOffline").textContent=devices.filter(x=>x.status==="offline").length;document.getElementById("countTotal").textContent=devices.length;if(devices.length===0){container.innerHTML="<div class=\\"empty-state\\"><h2>No devices yet</h2><p>Power on your ESP32 devices and they&apos;ll appear here automatically.</p><p style=\\"margin-top:8px;font-size:12px;color:#4444aa\\">Each device registers itself using its unique chip ID.</p></div>";return}' +
'let h="";' +
'for(const d of devices){' +
'const ls=d.lastSeen?timeAgo(d.lastSeen):"never";' +
'const sc=d.status==="online"?"online":"offline";' +
'h+="<div class=\\"device-card "+sc+"\\">";' +
'h+="<div class=\\"device-info\\">";' +
'h+="<div class=\\"device-name\\">"+esc(d.name)+"</div>";' +
'h+="<div class=\\"device-id\\">ID: "+esc(d.id)+"</div>";' +
'h+="<div class=\\"device-status\\"><span class=\\"dot "+sc+"\\"></span>"+d.status+" <span class=\\"last-seen\\">&bull; "+ls+"</span></div>";' +
'h+="</div>";' +
'h+="<div class=\\"device-actions\\">";' +
'h+="<button class=\\"btn btn-ping\\" onclick=\\"sendCmd(&apos;"+d.id+"&apos;,&apos;ping&apos;)\\">Ping</button>";' +
'h+="<button class=\\"btn btn-restart\\" onclick=\\"sendCmd(&apos;"+d.id+"&apos;,&apos;restart&apos;)\\">Restart</button>";' +
'h+="<button class=\\"btn btn-led-on\\" onclick=\\"sendCmd(&apos;"+d.id+"&apos;,&apos;led_on&apos;)\\">LED ON</button>";' +
'h+="<button class=\\"btn btn-led-off\\" onclick=\\"sendCmd(&apos;"+d.id+"&apos;,&apos;led_off&apos;)\\">LED OFF</button>";' +
'h+="</div></div>"}' +
'container.innerHTML=h}catch(e){console.error(e)}}' +
'function timeAgo(t){const s=Math.floor((Date.now()-t)/1000);if(s<5)return"just now";if(s<60)return s+"s ago";const m=Math.floor(s/60);if(m<60)return m+"m ago";return Math.floor(m/60)+"h ago"}' +
'function esc(s){const d=document.createElement("div");d.textContent=s;return d.innerHTML}' +
'loadDevices();setInterval(loadDevices,5000);' +
'</script>' +
'</body>' +
'</html>';

  try {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Dashboard error: ' + err.message);
  }
};
