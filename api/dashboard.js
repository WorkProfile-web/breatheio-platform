/**
 * GET /api/dashboard
 * Serves device dashboard with: live interactive command tracking and secure device controls.
 */
const store = require('./_store');

module.exports = async (req, res) => {
  await store.reloadFromBlob();
  const now = Date.now();
  const allDevices = store.getAllDevices();

  // Build cards on server
  let cards = '';
  if (allDevices.length === 0) {
    cards = '<div class="empty-state" id="emptyState"><h2>No devices connected</h2><p>Power on your ESP32 device and connect it to Wi-Fi via <b>BreatheIO-XXXX</b> hotspot.<br>It will automatically appear here once online.</p></div>';
  } else {
    const sorted = [...allDevices].sort((a, b) => {
      const aOn = (now - a.lastSeen) < 35000, bOn = (now - b.lastSeen) < 35000;
      if (aOn && !bOn) return -1;
      if (!aOn && bOn) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });
    for (const d of sorted) {
      const on = (now - d.lastSeen) < 35000;
      const cls = on ? 'online' : 'offline';
      const ls = d.lastSeen ? timeAgo(now, d.lastSeen) : 'never';
      const displayName = esc(d.name || ('ESP32-' + d.id.substring(0, 6)));
      const isNew = d.firstSeen && (now - d.firstSeen) < 900000; // <15 mins
      const newBadge = isNew ? '<span class="new-badge">🆕 NEW DEVICE</span>' : '';
      cards += `<div class="device-card ${cls}" data-device-id="${esc(d.id)}" data-name="${esc((d.name || '').toLowerCase())}" data-id-low="${esc(d.id.toLowerCase())}" data-ip="${esc(d.ip || '')}">
        <div class="device-info">
          <div class="device-header-line">
            <span class="device-name" id="dname-${esc(d.id)}" title="Double-click to rename">${displayName}</span>
            ${newBadge}
          </div>
          <div class="device-id">ID: ${esc(d.id)}</div>
          <div class="device-status">
            <span class="dot ${cls}" id="dot-${esc(d.id)}"></span>
            <span class="status-text" id="stxt-${esc(d.id)}">${on ? 'online' : 'offline'}</span>
            <span class="last-seen" id="ls-${esc(d.id)}">&bull; ${ls}</span>
          </div>
          <div class="last-command" id="lastcmd-${esc(d.id)}"></div>
        </div>
        <div class="device-actions">
          <button class="btn btn-secret" data-id="${esc(d.id)}" data-action="show_secret">Show Secret</button>
          <button class="btn btn-restart" data-id="${esc(d.id)}" data-action="restart">Restart</button>
          <button class="btn btn-wifi" data-id="${esc(d.id)}" data-action="wifi_reset">Reset WiFi</button>
          <button class="btn btn-pass" data-id="${esc(d.id)}" data-action="change_pass">Change Secret</button>
        </div>
      </div>`;
    }
  }

  const online = allDevices.filter(d => (now - d.lastSeen) < 35000).length;
  const offline = allDevices.length - online;

  const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>BreatheIO - Interactive Device Dashboard</title>
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
.search-bar{max-width:920px;margin:20px auto -10px;padding:0 20px;position:relative}
.search-bar input{width:100%;padding:12px 16px 12px 42px;background:#1a1a2e;border:1px solid #2a2a4a;border-radius:10px;color:#e0e0e0;font-size:15px;outline:none;transition:all .2s}
.search-bar input:focus{border-color:#00bcd4;background:#1e1e35}
.search-bar input::placeholder{color:#5555aa}
.search-bar .icon{position:absolute;left:34px;top:50%;transform:translateY(-50%);color:#5555aa;font-size:16px;pointer-events:none}
.search-bar .clear{position:absolute;right:34px;top:50%;transform:translateY(-50%);color:#5555aa;font-size:18px;cursor:pointer;display:none}
.search-bar .clear:hover{color:#aaa}
.container{max-width:920px;margin:30px auto;padding:0 20px}
.device-card{background:#1a1a2e;border:1px solid #2a2a4a;border-radius:12px;padding:20px;margin-bottom:12px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;transition:all .2s;position:relative}
.device-card.hidden{display:none}
.device-card:hover{border-color:#3a3a6a;background:#1e1e35}
.device-card.online{border-left:4px solid #00e676}
.device-card.offline{border-left:4px solid #ff5252;opacity:.6}
.device-info{display:flex;flex-direction:column;gap:4px;flex:1;min-width:180px}
.device-header-line{display:flex;align-items:center;gap:8px}
.device-name{font-size:16px;font-weight:600;color:#fff;cursor:pointer;padding:2px 6px;margin:-2px -6px;border-radius:4px;transition:all .15s}
.device-name:hover{background:rgba(255,255,255,0.06)}
.device-name.editing{padding:2px 6px;margin:-2px -6px;background:transparent;cursor:text}
.device-name input{background:#0f0f1a;border:1px solid #00bcd4;border-radius:4px;color:#fff;font-size:16px;font-weight:600;padding:4px 8px;width:100%;outline:none;font-family:inherit}
.device-name .save-hint{font-size:11px;color:#00bcd4;margin-left:4px;font-weight:400}
.new-badge{background:linear-gradient(90deg,#00e676,#00bcd4);color:#000;font-size:10px;font-weight:700;padding:2px 8px;border-radius:12px;animation:pulse 1.5s infinite}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(0,230,118,0.7)}70%{box-shadow:0 0 0 6px rgba(0,230,118,0)}100%{box-shadow:0 0 0 0 rgba(0,230,118,0)}}
.device-id{font-size:12px;color:#6666aa;font-family:monospace}
.device-status{font-size:13px;display:flex;align-items:center;gap:6px}
.device-status .dot{width:8px;height:8px;border-radius:50%;display:inline-block}
.device-status .dot.online{background:#00e676;box-shadow:0 0 6px #00e67688}
.device-status .dot.offline{background:#ff5252}
.last-command{font-size:12px;margin-top:6px;min-height:20px}
.cmd-pill{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:6px;font-size:12px;font-weight:500}
.cmd-pill.queued{background:rgba(255,193,7,0.15);color:#ffc107;border:1px solid rgba(255,193,7,0.3);animation:pulseYellow 1.5s infinite}
@keyframes pulseYellow{0%,100%{opacity:1}50%{opacity:.6}}
.cmd-pill.executed{background:rgba(0,230,118,0.15);color:#00e676;border:1px solid rgba(0,230,118,0.3)}
.cmd-pill.error{background:rgba(255,82,82,0.15);color:#ff5252;border:1px solid rgba(255,82,82,0.3)}
.device-actions{display:flex;gap:8px;flex-wrap:wrap}
.btn{padding:8px 16px;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;transition:all .2s;color:#fff;min-width:75px;text-align:center;position:relative}
.btn:active{transform:scale(.92)}
.btn:disabled{opacity:.5;cursor:wait;transform:none}
.btn-secret{background:#6a1b9a}.btn-secret:hover:not(:disabled){background:#8e24aa}
.btn-restart{background:#e53935}.btn-restart:hover:not(:disabled){background:#ef5350}
.btn-wifi{background:#e65100}.btn-wifi:hover:not(:disabled){background:#ff6d00}
.btn-pass{background:#00838f}.btn-pass:hover:not(:disabled){background:#00acc1}
.empty-state{text-align:center;padding:80px 20px;color:#6666aa}
.empty-state h2{font-size:22px;margin-bottom:10px;color:#8888bb}
.empty-state p{font-size:14px;line-height:1.6}
.toast{position:fixed;bottom:30px;right:30px;background:#1a1a2e;border:1px solid #2a2a4a;padding:14px 24px;border-radius:10px;font-size:14px;display:none;box-shadow:0 8px 32px rgba(0,0,0,.4);z-index:100}
.toast.show{display:block;animation:slideIn .3s}
@keyframes slideIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
.last-seen{font-size:12px;color:#5555aa}
.no-results{text-align:center;padding:40px 20px;color:#5555aa;display:none}
.pwd-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:1000;display:none;align-items:center;justify-content:center;backdrop-filter:blur(5px)}
.pwd-box{background:#1a1a2e;border:1px solid #2a2a4a;border-radius:14px;padding:28px;width:400px;max-width:90vw}
.pwd-title{font-size:18px;font-weight:600;color:#fff;margin-bottom:6px}
.pwd-hint{font-size:13px;color:#8888aa;margin-bottom:16px;line-height:1.5}
.pwd-box input{width:100%;padding:12px 14px;background:#0f0f1a;border:1px solid #2a2a4a;border-radius:8px;color:#fff;font-size:15px;outline:none;font-family:monospace;letter-spacing:2px}
.pwd-box input:focus{border-color:#00bcd4}
.pwd-error{color:#ff5252;font-size:13px;margin-top:8px;display:none}
.pwd-btns{display:flex;gap:10px;margin-top:20px;justify-content:flex-end}
.pwd-btns button{padding:10px 20px;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;transition:all .15s}
.pwd-btns button:active{transform:scale(.95)}
#pwdCancel{background:#2a2a4a;color:#aaa}
#pwdCancel:hover{background:#3a3a5a}
#pwdSubmit{background:linear-gradient(90deg,#00e676,#00bcd4);color:#000;font-weight:600}
@media(max-width:600px){.header{padding:15px}.device-card{flex-direction:column;align-items:flex-start}.device-actions{width:100%;justify-content:flex-start}}
</style></head><body>
<div class="header">
<div><h1>BreatheIO Platform</h1><div class="subtitle">Interactive ESP32 Remote Management</div></div>
<div class="stats"><div class="stat online"><div class="num" id="nOnline">${online}</div><div class="label">Online</div></div>
<div class="stat offline"><div class="num" id="nOffline">${offline}</div><div class="label">Offline</div></div>
<div class="stat total"><div class="num" id="nTotal">${allDevices.length}</div><div class="label">Total</div></div></div></div>
<div class="search-bar">
<span class="icon">🔍</span>
<input type="text" id="searchInput" placeholder="Search by name, ID, or IP..." autocomplete="off">
<span class="clear" id="clearBtn">✕</span>
</div>
<div class="container" id="devicesContainer">${cards}</div>
<div class="no-results" id="noResults"><h3>No matching devices</h3><p>Try a different search term</p></div>
<div class="toast" id="toast"></div>

<!-- Secret Prompt Dialog -->
<div class="pwd-overlay" id="pwdOverlay">
<div class="pwd-box">
<div class="pwd-title" id="pwdTitle">Enter device secret</div>
<div class="pwd-hint">Enter secret to confirm command execution.</div>
<input type="password" id="pwdInput" maxlength="32" placeholder="Device secret">
<div class="pwd-error" id="pwdError">Wrong secret</div>
<div class="pwd-btns">
<button id="pwdCancel">Cancel</button>
<button id="pwdSubmit">Send Command</button>
</div>
</div>
</div>

<!-- Change Secret Overlay -->
<div class="pwd-overlay" id="cpOverlay">
<div class="pwd-box">
<div class="pwd-title">Set new device secret</div>
<div class="pwd-hint">Enter a new secret for this device (4-32 characters).</div>
<input type="password" id="cpNewInput" maxlength="32" placeholder="New secret">
<input type="password" id="cpConfirmInput" maxlength="32" placeholder="Confirm new secret" style="margin-top:10px">
<div class="pwd-error" id="cpError" style="margin-top:10px">Secrets don&apos;t match or too short</div>
<div class="pwd-btns">
<button id="cpCancel">Cancel</button>
<button id="cpSubmit" style="background:linear-gradient(90deg,#00e676,#00bcd4);color:#000;font-weight:600">Change Secret</button>
</div>
</div>
</div>

<script>
(function(){
var to=document.getElementById("toast");
var tt;
function sm(m,e){clearTimeout(tt);to.textContent=m;to.style.borderColor=e?"#ff5252":"#2a2a4a";to.classList.add("show");tt=setTimeout(function(){to.classList.remove("show")},3500)}

// Modals
var pwdOverlay=document.getElementById("pwdOverlay");
var pwdInput=document.getElementById("pwdInput");
var pwdError=document.getElementById("pwdError");
var pwdTitle=document.getElementById("pwdTitle");
var cpOverlay=document.getElementById("cpOverlay");
var cpNewInput=document.getElementById("cpNewInput");
var cpConfirmInput=document.getElementById("cpConfirmInput");
var cpError=document.getElementById("cpError");

var pwdPendingId=null,pwdPendingAc=null,pwdPendingOrig=null,pwdPendingBtn=null,pwdPendingDn=null,pwdPendingNewName=null,pwdPendingIsRename=false,pwdPendingIsChangePass=false,pwdPendingCpSecret=null;
var activeCommandTimestamps={};

// Show secret prompt dialog
function showPwd(id,title){
  pwdTitle.textContent=title;
  pwdError.style.display="none";
  pwdInput.value="";
  pwdOverlay.style.display="flex";
  setTimeout(function(){pwdInput.focus()},100);
}
pwdCancel.onclick=function(){pwdOverlay.style.display="none";if(pwdPendingBtn){pwdPendingBtn.disabled=false;pwdPendingBtn.textContent=pwdPendingOrig}clearPending()};
pwdInput.onkeydown=function(e){if(e.key==="Enter")pwdSubmit.click();if(e.key==="Escape")pwdCancel.click()};
pwdSubmit.onclick=function(){
  var s=pwdInput.value.trim();
  pwdOverlay.style.display="none";
  if(pwdPendingIsRename){doRenameWithSecret(pwdPendingId,pwdPendingNewName,pwdPendingDn,s);clearPending()}
  else if(pwdPendingIsChangePass){showCpOverlay(s)}
  else{doCommandWithSecret(pwdPendingId,pwdPendingAc,pwdPendingOrig,pwdPendingBtn,s);clearPending()}
};
function clearPending(){pwdPendingId=null;pwdPendingAc=null;pwdPendingOrig=null;pwdPendingBtn=null;pwdPendingDn=null;pwdPendingNewName=null;pwdPendingIsRename=false;pwdPendingIsChangePass=false;pwdPendingCpSecret=null}

function showCpOverlay(currentSecret){
  pwdPendingCpSecret=currentSecret;
  cpNewInput.value="";cpConfirmInput.value="";cpError.style.display="none";
  cpOverlay.style.display="flex";
  setTimeout(function(){cpNewInput.focus()},100);
}
cpCancel.onclick=function(){cpOverlay.style.display="none";clearPending()};
cpNewInput.onkeydown=function(e){if(e.key==="Enter")cpConfirmInput.focus();if(e.key==="Escape")cpCancel.click()};
cpConfirmInput.onkeydown=function(e){if(e.key==="Enter")cpSubmit.click();if(e.key==="Escape")cpCancel.click()};
cpSubmit.onclick=function(){
  var pw=cpNewInput.value;
  var cf=cpConfirmInput.value;
  if(pw.length<4||pw.length>32||pw!==cf){cpError.style.display="block";return}
  cpError.style.display="none";
  cpOverlay.style.display="none";
  var id=pwdPendingId;
  doCommandWithSecret(id,"set_password:"+pw,"Change Secret",pwdPendingBtn,pwdPendingCpSecret);
  clearPending();
};

// Search
var si=document.getElementById("searchInput");
var cb=document.getElementById("clearBtn");
si.oninput=function(){
  var q=si.value.toLowerCase().trim();
  var cards=document.querySelectorAll(".device-card");
  var count=0;
  cb.style.display=q?"block":"none";
  for(var i=0;i<cards.length;i++){
    var c=cards[i];
    var n=(c.getAttribute("data-name")||"").toLowerCase();
    var id=(c.getAttribute("data-id-low")||"").toLowerCase();
    var ip=(c.getAttribute("data-ip")||"").toLowerCase();
    if(!q||n.indexOf(q)>-1||id.indexOf(q)>-1||ip.indexOf(q)>-1){
      c.classList.remove("hidden");count++;
    }else{
      c.classList.add("hidden");
    }
  }
  document.getElementById("noResults").style.display=(count===0&&cards.length>0)?"block":"none";
};
cb.onclick=function(){si.value="";si.oninput();si.focus()};

// Inline rename
document.addEventListener("dblclick",function(e){
  var dn=e.target.closest(".device-name");
  if(!dn||dn.classList.contains("editing"))return;
  var id=dn.closest(".device-card").getAttribute("data-device-id");
  var cur=dn.textContent.trim();
  dn.classList.add("editing");
  dn.innerHTML='<input type="text" id="renameInput" value="'+cur.replace(/"/g,'&quot;')+'" maxlength="32"><span class="save-hint">Enter to save</span>';
  var inp=document.getElementById("renameInput");
  inp.focus();inp.select();
  inp.onkeydown=function(ev){
    if(ev.key==="Enter")startRename(id,inp.value,dn);
    if(ev.key==="Escape"){dn.classList.remove("editing");dn.textContent=cur;}
    ev.stopPropagation();
  };
  inp.onblur=function(){setTimeout(function(){startRename(id,inp.value,dn)},150)};
});
function startRename(id,newName,dn){
  newName=newName.trim();
  if(!newName||newName.length<1){dn.classList.remove("editing");dn.textContent=dn.getAttribute("data-orig")||"...";return;}
  pwdPendingId=id;pwdPendingNewName=newName;pwdPendingDn=dn;pwdPendingIsRename=true;
  showPwd(id,"Enter secret to rename");
}
function doRenameWithSecret(id,newName,dn,secret){
  var orig=dn.textContent;
  dn.innerHTML="...";
  var x=new XMLHttpRequest();
  x.open("POST","/api/rename");
  x.setRequestHeader("Content-Type","application/json");
  x.onload=function(){
    try{var d=JSON.parse(x.responseText);
    if(d.success){
      dn.classList.remove("editing");dn.textContent=d.name;
      dn.closest(".device-card").setAttribute("data-name",d.name.toLowerCase());
      sm("Renamed to "+d.name);
    }else{
      dn.classList.remove("editing");dn.textContent=orig;
      sm("Rename failed: "+d.error,true);
    }}catch(e){dn.classList.remove("editing");dn.textContent=orig;sm("Error",true)}
  };
  x.onerror=function(){dn.classList.remove("editing");dn.textContent=orig;sm("Network error",true)};
  x.send(JSON.stringify({deviceId:id,name:newName,deviceSecret:secret}));
}

// Button actions
document.addEventListener("click",function(e){
var b=e.target.closest(".btn");
if(!b||b.disabled)return;
var id=b.getAttribute("data-id");
var ac=b.getAttribute("data-action");

// Show Secret — sends command to print secret on ESP32 Serial Monitor ONLY
if(ac==="show_secret"){
  doCommandWithSecret(id,ac,b.textContent,b,"");
  return;
}
if(ac==="change_pass"){
  pwdPendingId=id;pwdPendingAc=ac;pwdPendingOrig=b.textContent;pwdPendingBtn=b;pwdPendingIsChangePass=true;
  showPwd(id,"Enter current secret for "+id.slice(0,6)+"...");
  return;
}
pwdPendingId=id;pwdPendingAc=ac;pwdPendingOrig=b.textContent;pwdPendingBtn=b;pwdPendingIsRename=false;
showPwd(id,"Enter secret for "+id.slice(0,6)+"...");
});

// Send Command with 3-Stage Interactive Progress
function doCommandWithSecret(id,ac,orig,b,secret){
b.disabled=true;b.textContent="⏳ Queuing...";
var sentTime=Date.now();
activeCommandTimestamps[id]={action:ac,time:sentTime,btn:b,origName:orig};

var lc=document.getElementById("lastcmd-"+id);
if(lc){
  lc.innerHTML='<span class="cmd-pill queued">⏳ Sent to Cloud &bull; Waiting for ESP32 check-in...</span>';
}

var x=new XMLHttpRequest();
x.open("POST","/api/command");
x.setRequestHeader("Content-Type","application/json");
x.onload=function(){
  try{
    var d=JSON.parse(x.responseText);
    if(d.success){
      if(ac==="show_secret"){
        sm("🔒 'show_secret' sent! Secret will print to hardware Serial Monitor only.");
      }else{
        sm('Command "'+ac+'" queued! Waiting for ESP32...');
      }
    }else{
      b.textContent=orig;b.disabled=false;
      if(lc)lc.innerHTML='<span class="cmd-pill error">✗ '+(d.error||"Command failed")+'</span>';
      sm("Error: "+d.error,true);
      delete activeCommandTimestamps[id];
    }
  }catch(e){
    b.textContent=orig;b.disabled=false;
    if(lc)lc.innerHTML='<span class="cmd-pill error">✗ Network error</span>';
    sm("Network error",true);
    delete activeCommandTimestamps[id];
  }
};
x.onerror=function(){
  b.textContent=orig;b.disabled=false;
  if(lc)lc.innerHTML='<span class="cmd-pill error">✗ Network error</span>';
  sm("Network error",true);
  delete activeCommandTimestamps[id];
};
x.send(JSON.stringify({deviceId:id,action:ac,deviceSecret:secret}));
}

// Live polling (every 3 seconds for instant response)
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
var isOn=(now-dv.lastSeen)<35000;
if(isOn)on++;else off++;

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

  // Check interactive command execution status!
  var lc=document.getElementById("lastcmd-"+dv.id);
  var activeTrack=activeCommandTimestamps[dv.id];

  if(activeTrack && dv.lastExecutedCommand){
    if(dv.lastExecutedCommand.action === activeTrack.action){
      // Command Executed Successfully on ESP32!
      if(lc) lc.innerHTML='<span class="cmd-pill executed">✅ ESP32 executed '+dv.lastExecutedCommand.action+'!</span>';
      if(activeTrack.btn){
        activeTrack.btn.innerHTML='✓ Executed!';
        (function(b,orig){
          setTimeout(function(){b.innerHTML=orig;b.disabled=false},2500);
        })(activeTrack.btn, activeTrack.origName);
      }
      if(dv.lastExecutedCommand.action==="show_secret"){
        sm("🔒 ESP32 received show_secret! Secret printed to USB Serial Monitor.");
      }else{
        sm('🎉 ESP32 executed "'+dv.lastExecutedCommand.action+'" successfully!');
      }
      delete activeCommandTimestamps[dv.id];
    }
  } else if(!activeTrack && dv.lastExecutedCommand && lc && !lc.innerHTML){
    lc.innerHTML='<span class="cmd-pill executed">✅ Last action: '+dv.lastExecutedCommand.action+'</span>';
  }
}
}
document.getElementById("nOnline").textContent=on;
document.getElementById("nOffline").textContent=off;
document.getElementById("nTotal").textContent=d.devices.length;
}catch(e){}};x.send()},3000);
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
