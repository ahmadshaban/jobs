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
 var isAdmin=!!document.getElementById('adminInstallButton'),isCC=document.body.dataset.variant==='cc';
 var pending=window.__jgInstallPrompt||null,installed=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();pending=e});
 window.addEventListener('appinstalled',function(){pending=null;installed=true;document.querySelectorAll('[data-install-app]').forEach(function(b){b.textContent='تثبيت التطبيق على الموبايل'})});
 function instructions(){
  var old=document.getElementById('installHelp');if(old){old.showModal();return}
  var d=document.createElement('dialog');d.id='installHelp';d.dir='rtl';d.style.cssText='box-sizing:border-box;width:min(440px,calc(100% - 28px));max-height:85dvh;overflow:auto;border:1px solid #b7c7d4;border-radius:18px;padding:20px;color:#20374b;background:#fff;font:14px Tajawal,Arial;line-height:1.9;margin:auto;box-shadow:0 18px 70px #0005';
  var h=document.createElement('h2');h.textContent=installed?'التطبيق متسطب عندك':'تثبيت التطبيق على الموبايل';h.style.fontSize='19px';var p=document.createElement('p');
  var ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||(/Mac/.test(navigator.userAgent)&&navigator.maxTouchPoints>1);
  p.textContent=installed?'افتح التطبيق من أيقونته على شاشة الموبايل. لو شكله قديم، اقفله وافتحه وإنت متصل بالنت عشان يتحدث.':ios?'افتح الصفحة في Safari. دوس مشاركة ⬆، وبعدها «إضافة إلى الشاشة الرئيسية»، وبعدين «إضافة». افتحه بعد كده من الأيقونة عشان يشتغل من غير شريط اللينك.':'في Chrome دوس على التلات نقط ⋮، واختار «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية». افتحه من الأيقونة بعد التثبيت عشان يشتغل من غير شريط اللينك. لو الاختيار مش ظاهر، افتح اللينك في Chrome نفسه مش جوه واتساب.';
  var oldHelp=document.createElement('details'),sum=document.createElement('summary'),q=document.createElement('p');sum.textContent='كان متسطب قبل كده أو مفيش تأكيد تثبيت؟';q.textContent='لو التطبيق كان متسطب عندك قبل كده ومش بيظهر تأكيد التثبيت: دوس مطوّل على الأيقونة القديمة من شاشة الموبايل، واختار إلغاء التثبيت أو إزالة. افتح اللينك تاني في Chrome ودوس تثبيت التطبيق على الموبايل، أو افتح التلات نقط واختار إضافة إلى الشاشة الرئيسية. امسح اختصار التطبيق بس، مش Chrome ولا بيانات المتصفح. الموقع ميقدرش يمسح الأيقونة من موبايلك.';oldHelp.open=true;oldHelp.append(sum,q);
  var prefix=document.body.getAttribute('data-prefix')||'',root=new URL(prefix||'./',location.href);if(document.body.dataset.variant==='cc')root=new URL('../',root);
  (isAdmin?[['الموقع الأساسي','index.html'],['نسخة CC','cc/index.html']]:[]).forEach(function(v){var a=document.createElement('a');a.href=new URL(v[1],root).href;a.textContent=v[0];a.style.cssText='display:block;margin:6px 0;padding:8px 12px;background:#edf2f6;border-radius:9px;color:#244b68';oldHelp.appendChild(a)});
  var close=document.createElement('button');close.textContent='تمام';close.style.cssText='font:inherit;width:100%;border:0;border-radius:10px;padding:10px;background:#29495f;color:white;margin-top:14px;min-height:44px';close.onclick=function(){d.close()};d.append(h,p,oldHelp,close);document.body.appendChild(d);d.showModal();
 }
 var app=new URLSearchParams(location.search).get('app')||'dashboard';
 var options=[['dashboard','لوحة الإدارة','admin.html'],['stats','الإحصائيات','admin.html?app=stats#analytics'],['applicants','المتقدمين','admin.html?app=applicants#applicants']];
 function adminChoices(){
  if(document.getElementById('app').classList.contains('hidden'))return;
  var d=document.getElementById('adminInstallChoices');if(d){d.showModal();return}
  d=document.createElement('dialog');d.id='adminInstallChoices';d.dir='rtl';d.style.cssText='width:min(440px,calc(100% - 28px));box-sizing:border-box;border:1px solid #426188;border-radius:18px;padding:20px;background:#132440;color:#eaf1ff;font:14px Tajawal,Arial;line-height:1.8';
  var h=document.createElement('h2');h.textContent='تثبيت التطبيق على الموبايل';h.style.fontSize='19px';var p=document.createElement('p');p.textContent='اختار الأيقونة اللي عايزها. كل اختيار بيفتح قسمه، وتسجيل الدخول مطلوب زي ما هو.';d.append(h,p);
  options.forEach(function(v){var b=document.createElement('button');b.type='button';b.textContent='تثبيت '+v[1]+(v[0]===app?' (الصفحة الحالية)':'');b.style.cssText='display:block;width:100%;min-height:52px;text-align:right;margin:10px 0;border:1px solid #426188;border-radius:10px;background:#203958;color:#eaf1ff;padding:10px 14px;font:inherit;font-weight:700';b.onclick=function(){if(v[0]===app){d.close();installCurrent()}else{var url=new URL(v[2],location.href);url.searchParams.set('install','1');location.href=url.href}};d.append(b)});
  var note=document.createElement('p');note.style.cssText='font-size:12px;color:#b8cce6';note.textContent='لو اخترت قسم تاني، هيفتح الأول. بعدها اختار تثبيته من نفس الزرار. المتصفح هو اللي بيأكد التثبيت؛ لو مش متاح هيظهر السبب باختصار.';d.append(note);
  var close=document.createElement('button');close.textContent='رجوع';close.style.cssText='font:inherit;min-height:44px;width:100%;background:#4f9cff;color:#07182d;border:0;border-radius:10px';close.onclick=function(){d.close()};d.append(close);document.body.append(d);d.showModal();
 }
 function installStatus(text){var n=document.getElementById('installStatus');if(!n){n=document.createElement('div');n.id='installStatus';n.setAttribute('role','status');n.style.cssText='position:fixed;bottom:88px;left:14px;right:14px;z-index:9999;background:#17365a;color:#fff;border:1px solid #7c97b5;border-radius:12px;padding:14px;text-align:center;font:700 14px Tajawal,Arial;line-height:1.7';document.body.append(n)}n.textContent=text;setTimeout(function(){n.remove()},7000)}
 async function installCurrent(){pending=pending||window.__jgInstallPrompt;if(pending){var event=pending;pending=null;window.__jgInstallPrompt=null;try{await event.prompt();var choice=await event.userChoice;if(choice&&choice.outcome==='dismissed')installStatus('التثبيت اتلغى. مفيش حاجة اتثبتت.')}catch(_){installStatus('المتصفح مش موفّر التثبيت دلوقتي.')}}else if(/iPhone|iPad|iPod/.test(navigator.userAgent)||(/Mac/.test(navigator.userAgent)&&navigator.maxTouchPoints>1))instructions();else installStatus(installed?'التطبيق متثبت بالفعل. افتحه من أيقونته على موبايلك.':'المتصفح مش موفّر تأكيد التثبيت دلوقتي. لو فيه نسخة قديمة متثبتة، شيل أيقونتها وجرب تاني.');}

 document.addEventListener('click',function(e){var b=e.target.closest('[data-install-app]');if(!b)return;e.preventDefault();if(isAdmin)adminChoices();else installCurrent()});
 if(isAdmin&&new URLSearchParams(location.search).get('install')==='1'){var showAfterAuth=function(){if(!document.getElementById('app').classList.contains('hidden')){adminChoices();return true}return false};if(!showAfterAuth()){var watch=new MutationObserver(function(){if(showAfterAuth())watch.disconnect()});watch.observe(document.getElementById('app'),{attributes:true,attributeFilter:['class']})}}
 var target=document.querySelector('.drawer');if(target&&!document.getElementById('adminInstallButton')){var btn=document.createElement('button');btn.type='button';btn.className='d-link';btn.dataset.installApp='';btn.textContent='تثبيت التطبيق على الموبايل';btn.style.cssText='font:inherit;text-align:right;border:1px solid #c5d3dd;background:#edf2f6;cursor:pointer';target.appendChild(btn)}
})();
