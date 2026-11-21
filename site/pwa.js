/* Install shortcut and show cached pages honestly when offline. */
(function(){
 var prefix=document.body.getAttribute('data-prefix')||'';
 if('serviceWorker' in navigator)navigator.serviceWorker.register(prefix+'sw.js').catch(function(){});
 function status(){
  var old=document.getElementById('offlineNotice');
  if(navigator.onLine){if(old)location.reload();return}
  if(old)return;
  var box=document.createElement('div');box.id='offlineNotice';box.setAttribute('role','status');box.style.cssText='position:relative;z-index:99;padding:12px;background:#fff3cd;color:#694b00;text-align:center;font-weight:700';
  box.textContent='أنت مش متصل بالنت. دي نسخة محفوظة وممكن الوظيفة تكون اتغيرت. اتصل بالنت قبل التقديم.';
  document.body.prepend(box);
 }
 status();window.addEventListener('offline',status);window.addEventListener('online',status);
 var fields=document.querySelectorAll('#apply input,#ccform input');
 var dirty=false;fields.forEach(function(i){i.addEventListener('input',function(){dirty=true})});
 window.addEventListener('beforeunload',function(e){if(dirty){e.preventDefault();e.returnValue=''}});
 // Keep the old home-exit confirmation without changing normal back navigation inside the site.
 if(!document.body.classList.contains('pg-home'))return;
 var armed=false,dialog=null;
 function arm(){if(armed)return;armed=true;history.replaceState({jobgateBase:true},'',location.href);history.pushState({jobgateGuard:true},'',location.href)}
 window.addEventListener('pointerdown',arm,{once:true});
 window.addEventListener('keydown',arm,{once:true});
 window.addEventListener('popstate',function(e){
  if(!e.state||!e.state.jobgateBase||dialog)return;
  dialog=document.createElement('dialog');dialog.className='cfov';
  dialog.innerHTML='<div class="cfsheet"><h3>عايز تخرج من الموقع؟</h3><button type="button" class="btn btn-wa" id="stayHere">أكمّل في الموقع</button><button type="button" class="btn btn-ghost2" id="leaveSite">خروج</button></div>';
  document.body.appendChild(dialog);dialog.showModal();
  function stay(){dialog.remove();dialog=null;history.pushState({jobgateGuard:true},'',location.href)}
  document.getElementById('stayHere').onclick=stay;
  dialog.addEventListener('cancel',function(e){e.preventDefault();stay()});
  document.getElementById('leaveSite').onclick=function(){dialog.remove();dialog=null;history.back()};
 });
})();
