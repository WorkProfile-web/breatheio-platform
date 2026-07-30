/**
 * GET /api/dashboard
 * Serves device dashboard with button feedback and ping display.
 * Uses backtick template literal for HTML to avoid quote escaping issues.
 */
const store = require('./_store');

module.exports = async (req, res) => {
  await store.reloadFromBlob();
  const now = Date.now();
  const allDevices = store.getAllDevices();

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
      cards += `<div class="device-card ${cls}" data-device-id="${esc(d.id)}">
        <div class="device-info">
          <div class="device-name">${esc(d.name || ('ESP32-' + d.id.substring(0, 6)))}</div>
          <div class="device-id">ID: ${esc(d.id)}</div>
          <div class="device-status">
            <span class="dot ${cls}" id="dot-${esc(d.id)}"></span>
            <span class="status-text" id="stxt-${esc(d.id)}">${on ? 'online' : 'offline'}</span>
            <span class="last-seen" id="ls-${esc(d.id)}">&bull; ${ls}</span>
          </div>
          <div class="last-command" id="lastcmd-${esc(d.id)}"></div>
        </div>
        <div class="device-actions">
          <button class="btn btn-ping" data-id="${esc(d.id)}" data-action="ping">Ping</button>
          <button class="btn btn-restart" data-id="${esc(d.id)}" data-action="restart">Restart</button>
          <button class="btn btn-led-on" data-id="${esc(d.id)}" data-action="led_on">LED ON</button>
          <button class="btn btn-led-off" data-id="${esc(d.id)}" data-action="led_off">LED OFF</button>
        </div>
        <div class="ping-results" id="ping-${esc(d.id)}" style="display:none"></div>
      </div>`;
    }
  }

  const online = allDevices.filter(d => (now - d.lastSeen) < 180000).length;
  const offline = allDevices.length - online;

  const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>BreatheIO - Device Dashboard</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0f0f1a;color:#e0e0e0;min-height:100vh}
.header{background:linear-gradient(135deg,#1a1a2e,#16213e);padding:20px 30px;border-bottom:1px solid #2a2a4a;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:15px}
.header h1{font-size:24px;background:linear-gradient(90deg,#00e676,#00bcd4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.header .subtitle{color:#8888aa;font-size:14px}
.stats{display:flex;gap:20px;flex-wrap:wrap}
.stat{text-align:center;padding:8px 16px;background:rgba(255,255,255,0.05);border-radius:8px;min-width:80px}
.stat .num{font-size:22px;font-weight:bold}
.stat .label{font-size:11px;color:#8888aa;text-transform:uppercase}
.stat.online .num{color:#00e676}
.stat.offline .num{color:#ff5252}
.stat.total .num{color:#82b1ff}
.container{max-width:920px;margin:30px auto;padding:0 20px}
.device-card{background:#1a1a2e;border:1px solid #2a2a4a;border-radius:12px;padding:20px;margin-bottom:12px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;transition:all .2s;position:relative}
.device-card:hover{border-color:#3a3a6a;background:#1e1e35}
.device-card.online{border-left:4px solid #00e676}
.device-card.offline{border-left:4px solid #ff5252;opacity:.6}
.device-info{display:flex;flex-direction:column;gap:4px}
.device-name{font-size:16px;font-weight:600;color:#fff}
.device-id{font-size:12px;color:#6666aa;font-family:monospace}
.device-status{font-size:13px;display:flex;align-items:center;gap:6px}
.device-status .dot{width:8px;height:8px;border-radius:50%;display:inline-block}
.device-status .dot.online{background:#00e676;box-shadow:0 0 6px #00e67688}
.device-status .dot.offline{background:#ff5252}
.last-command{font-size:11px;color:#8888aa;margin-top:2px}
.last-command .ok{color:#00e676}
.last-command .err{color:#ff5252}
.device-actions{display:flex;gap:8px;flex-wrap:wrap}
.btn{padding:8px 16px;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;transition:all .2s;color:#fff;min-width:75px;text-align:center;position:relative}
.btn:active{transform:scale(.92)}
.btn:disabled{opacity:.5;cursor:wait;transform:none}
.btn-ping{background:#3949ab}.btn-ping:hover:not(:disabled){background:#5c6bc0}
.btn-restart{background:#e53935}.btn-restart:hover:not(:disabled){background:#ef5350}
.btn-led-on{background:#2e7d32}.btn-led-on:hover:not(:disabled){background:#43a047}
.btn-led-off{background:#6d4c41}.btn-led-off:hover:not(:disabled){background:#8d6e63}
.empty-state{text-align:center;padding:80px 20px;color:#6666aa}
.empty-state h2{font-size:22px;margin-bottom:10px;color:#8888bb}
.empty-state p{font-size:14px;line-height:1.6}
.toast{position:fixed;bottom:30px;right:30px;background:#1a1a2e;border:1px solid #2a2a4a;padding:14px 24px;border-radius:10px;font-size:14px;display:none;box-shadow:0 8px 32px rgba(0,0,0,.4);z-index:100}
.toast.show{display:block;animation:slideIn .3s}
@keyframes slideIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
.last-seen{font-size:12px;color:#5555aa}
.ping-results{width:100%;margin-top:8px;padding:12px 16px;background:rgba(255,255,255,0.03);border-radius:8px;border:1px solid #2a2a4a;animation:slideDown .3s}
@keyframes slideDown{from{opacity:0;max-height:0}to{opacity:1;max-height:300px}}
.ping-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.ping-header .title{font-size:13px;font-weight:600;color:#82b1ff}
.ping-header .stats{font-size:12px;display:flex;gap:12px}
.ping-header .stats span{color:#aaa}
.ping-header .stats .min{color:#00e676}
.ping-header .stats .avg{color:#ffd740}
.ping-header .stats .max{color:#ff5252}
.ping-bars{display:flex;align-items:flex-end;gap:4px;height:40px;margin-top:4px}
.ping-bar{flex:1;border-radius:3px 3px 0 0;min-height:4px;transition:all .3s;position:relative}
.ping-bar.good{background:#00e676}
.ping-bar.okay{background:#ffd740}
.ping-bar.slow{background:#ff5252}
.ping-bar .bar-label{position:absolute;bottom:-16px;left:50%;transform:translateX(-50%);font-size:9px;color:#666}
.ping-bar .bar-ms{position:absolute;top:-16px;left:50%;transform:translateX(-50%);font-size:10px;color:#aaa;white-space:nowrap}
.ping-loss{font-size:11px;margin-top:16px;color:#888}
.ping-loss .lost{color:#ff5252}
@media(max-width:600px){.header{padding:15px}.device-card{flex-direction:column;align-items:flex-start}.device-actions{width:100%;justify-content:flex-start}}
</style></head><body>
<div class="header">
<div><h1>BreatheIO Platform</h1><div class="subtitle">Your ESP32 devices, anywhere</div></div>
<div class="stats"><div class="stat online"><div class="num" id="nOnline">${online}</div><div class="label">Online</div></div>
<div class="stat offline"><div class="num" id="nOffline">${offline}</div><div class="label">Offline</div></div>
<div class="stat total"><div class="num" id="nTotal">${allDevices.length}</div><div class="label">Total</div></div></div></div>
<div class="container" id="devicesContainer">${cards}</div>
<div class="toast" id="toast"></div>
<script>
(function(){
var to=document.getElementById("toast");
var tt;
function sm(m,e){clearTimeout(tt);to.textContent=m;to.style.borderColor=e?"#ff5252":"#2a2a4a";to.classList.add("show");tt=setTimeout(function(){to.classList.remove("show")},3000)}
// Button click with loading state + visual feedback
document.addEventListener("click",function(e){
var b=e.target.closest(".btn");
if(!b||b.disabled)return;
var id=b.getAttribute("data-id");
var ac=b.getAttribute("data-action");
var orig=b.textContent;
b.disabled=true;b.textContent="...";
var x=new XMLHttpRequest();
x.open("POST","/api/command");
x.setRequestHeader("Content-Type","application/json");
x.onload=function(){
  try{
    var d=JSON.parse(x.responseText);
    if(d.success){
      b.innerHTML=orig+' <span class="btn-feedback ok">✓</span>';
      var lc=document.getElementById("lastcmd-"+id);
      if(lc)lc.innerHTML="<span class=ok>✓ </span>"+ac+" sent at "+new Date().toLocaleTimeString();
      sm("Sent "+ac+" to "+id.slice(0,6)+"...");
    }else{
      b.innerHTML=orig+' <span class="btn-feedback err">✗</span>';
      sm("Error: "+d.error,true);
    }
  }catch(e){
    b.innerHTML=orig+' <span class="btn-feedback err">✗</span>';
    sm("Error",true);
  }
  setTimeout(function(){b.innerHTML=orig;b.disabled=false},2000);
};
x.onerror=function(){
  b.innerHTML=orig+' <span class="btn-feedback err">✗</span>';
  setTimeout(function(){b.innerHTML=orig;b.disabled=false},2000);
  sm("Network error",true);
};
x.send(JSON.stringify({deviceId:id,action:ac}))
});
// Poll devices every 5s: update stats + card appearance + ping results
setInterval(function(){
var x=new XMLHttpRequest();
x.open("GET","/api/devices");
x.onload=function(){try{
var d=JSON.parse(x.responseText);
if(!d.devices||d.devices.length===0)return;
var on=0,off=0;
for(var i=0;i<d.devices.length;i++){
var dv=d.devices[i];
var now=Date.now();
var isOn=(now-dv.lastSeen)<180000;
if(isOn)on++;else off++;
// Update card appearance
var card=document.querySelector('.device-card[data-device-id="'+dv.id+'"]');
if(card){
  var nc=isOn?"online":"offline";
  card.className="device-card "+nc;
  var dot=document.getElementById("dot-"+dv.id);if(dot)dot.className="dot "+nc;
  var stxt=document.getElementById("stxt-"+dv.id);if(stxt)stxt.textContent=nc;
  var ls=document.getElementById("ls-"+dv.id);
  if(ls){
    var sec=Math.floor((now-dv.lastSeen)/1000);
    var lb;
    if(sec<5)lb="\u2022 just now";
    else if(sec<60)lb="\u2022 "+sec+"s ago";
    else if(sec<3600)lb="\u2022 "+Math.floor(sec/60)+"m ago";
    else lb="\u2022 "+Math.floor(sec/3600)+"h ago";
    ls.textContent=lb;
  }
}
// Render ping results
var pel=document.getElementById("ping-"+dv.id);
if(pel&&dv.pingResults&&dv.pingResults.times){
  var pr=dv.pingResults;
  var mb=Math.max(pr.max,1);
  var bars="";
  for(var j=0;j<pr.times.length;j++){
    var t=pr.times[j];
    var pct=Math.max(t/mb*100,8);
    var cl=t<150?"good":t<350?"okay":"slow";
    bars+='<div class="ping-bar '+cl+'" style="height:'+pct+'%"><div class="bar-ms">'+t+'ms</div><div class="bar-label">'+(j+1)+'</div></div>';
  }
  pel.innerHTML='<div class="ping-header"><div class="title">PING Results</div><div class="stats"><span>Min: <b class="min">'+pr.min+'ms</b></span><span>Avg: <b class="avg">'+pr.avg+'ms</b></span><span>Max: <b class="max">'+pr.max+'ms</b></span></div></div><div class="ping-bars">'+bars+'</div>';
  if(pr.count<5&&!pel.querySelector('.ping-loss')){
    var lost=5-pr.count;
    pel.innerHTML+='<div class="ping-loss">Packet loss: <span class="lost">'+lost+'/'+pr.count+' ('+Math.round(lost/(lost+pr.count)*100)+'%)</span></div>';
  }
  pel.style.display="block";
}else if(pel){
  pel.style.display="none";
}
}
document.getElementById("nOnline").textContent=on;
document.getElementById("nOffline").textContent=off;
document.getElementById("nTotal").textContent=d.devices.length
}catch(e){}};x.send()},5000);
})();
</script></body></html>`;

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
