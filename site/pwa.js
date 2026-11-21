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

/* Native install prompt when available, honest device steps otherwise. */
(function(){
 var isAdmin=!!document.getElementById('adminInstallButton'),isCC=document.body.dataset.variant==='cc';if(!isAdmin&&!isCC)return;
 var pending=null,installed=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();pending=e});
 window.addEventListener('appinstalled',function(){pending=null;installed=true;document.querySelectorAll('[data-install-app]').forEach(function(b){b.textContent='التطبيق متسطب ✓'})});
 function instructions(){
  var old=document.getElementById('installHelp');if(old){old.showModal();return}
  var d=document.createElement('dialog');d.id='installHelp';d.dir='rtl';d.style.cssText='box-sizing:border-box;width:min(440px,calc(100% - 28px));max-height:85dvh;overflow:auto;border:1px solid #b7c7d4;border-radius:18px;padding:20px;color:#20374b;background:#fff;font:14px Tajawal,Arial;line-height:1.9;margin:auto;box-shadow:0 18px 70px #0005';
  var h=document.createElement('h2');h.textContent=installed?'التطبيق متسطب عندك':'سطّب التطبيق';h.style.fontSize='19px';var p=document.createElement('p');
  var ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||(/Mac/.test(navigator.userAgent)&&navigator.maxTouchPoints>1);
  p.textContent=installed?'افتح التطبيق من أيقونته على شاشة الموبايل. لو شكله قديم، اقفله وافتحه وإنت متصل بالنت عشان يتحدث.':ios?'افتح الصفحة في Safari. دوس مشاركة ⬆، وبعدها «إضافة إلى الشاشة الرئيسية»، وبعدين «إضافة». افتحه بعد كده من الأيقونة عشان يشتغل من غير شريط اللينك.':'في Chrome دوس على التلات نقط ⋮، واختار «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية». افتحه من الأيقونة بعد التثبيت عشان يشتغل من غير شريط اللينك. لو الاختيار مش ظاهر، افتح اللينك في Chrome نفسه مش جوه واتساب.';
  var oldHelp=document.createElement('details'),sum=document.createElement('summary'),q=document.createElement('p');sum.textContent='كان متسطب قبل كده أو مفيش تأكيد تثبيت؟';q.textContent='لو التطبيق كان متسطب عندك قبل كده ومش بيظهر تأكيد التثبيت: دوس مطوّل على الأيقونة القديمة من شاشة الموبايل، واختار إلغاء التثبيت أو إزالة. افتح اللينك تاني في Chrome ودوس سطّب التطبيق، أو افتح التلات نقط واختار إضافة إلى الشاشة الرئيسية. امسح اختصار التطبيق بس، مش Chrome ولا بيانات المتصفح. الموقع ميقدرش يمسح الأيقونة من موبايلك.';oldHelp.open=true;oldHelp.append(sum,q);
  var prefix=document.body.getAttribute('data-prefix')||'',root=new URL(prefix||'./',location.href);if(document.body.dataset.variant==='cc')root=new URL('../',root);
  (isAdmin?[['الموقع الأساسي','index.html'],['نسخة CC','cc/index.html']]:[]).forEach(function(v){var a=document.createElement('a');a.href=new URL(v[1],root).href;a.textContent=v[0];a.style.cssText='display:block;margin:6px 0;padding:8px 12px;background:#edf2f6;border-radius:9px;color:#244b68';oldHelp.appendChild(a)});
  var close=document.createElement('button');close.textContent='تمام';close.style.cssText='font:inherit;width:100%;border:0;border-radius:10px;padding:10px;background:#29495f;color:white;margin-top:14px;min-height:44px';close.onclick=function(){d.close()};d.append(h,p,oldHelp,close);document.body.appendChild(d);d.showModal();
 }
 document.addEventListener('click',async function(e){var b=e.target.closest('[data-install-app]');if(!b)return;e.preventDefault();if(pending){var event=pending;pending=null;try{await event.prompt();await event.userChoice}catch(_){instructions()}}else instructions()});
 var target=document.querySelector('.drawer');if(target&&!document.getElementById('adminInstallButton')){var btn=document.createElement('button');btn.type='button';btn.className='d-link';btn.dataset.installApp='';btn.textContent='↓ سطّب التطبيق';btn.style.cssText='font:inherit;text-align:right;border:1px solid #c5d3dd;background:#edf2f6;cursor:pointer';target.appendChild(btn)}
})();
