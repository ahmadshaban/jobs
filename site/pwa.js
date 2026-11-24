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
 // Native browser history exits only after the actual first page. No artificial home trap.

})();

/* Each app has its own manifest identity. Standalone display is not proof this app is installed. */
(function(){
 var isAdmin=!!document.getElementById('adminInstallButton'),isCC=document.body.dataset.variant==='cc';
 var pending=window.__jgInstallPrompt||null,installed=false;
 window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();pending=e});
 window.addEventListener('appinstalled',function(){pending=null;installed=true;document.querySelectorAll('[data-install-app]').forEach(function(b){var s=b.querySelector('span');if(s)s.textContent='تثبيت التطبيق على الموبايل';else b.textContent='تثبيت التطبيق على الموبايل'})});
 function instructions(){
  var old=document.getElementById('installHelp');if(old){old.showModal();return}
  var d=document.createElement('dialog');d.id='installHelp';d.dir='rtl';d.style.cssText='box-sizing:border-box;width:min(440px,calc(100% - 28px));max-height:85dvh;overflow:auto;border:1px solid #b7c7d4;border-radius:18px;padding:20px;color:#20374b;background:#fff;font:14px Tajawal,Arial;line-height:1.9;margin:auto;box-shadow:0 18px 70px #0005';
  var h=document.createElement('h2');h.textContent=installed?'التطبيق متسطب عندك':'تثبيت التطبيق على الموبايل';h.style.fontSize='19px';var p=document.createElement('p');
  var ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||(/Mac/.test(navigator.userAgent)&&navigator.maxTouchPoints>1);
  p.textContent=installed?'افتح التطبيق من أيقونته على شاشة الموبايل. لو شكله قديم، اقفله وافتحه وإنت متصل بالنت عشان يتحدث.':ios?'افتح الصفحة في Safari. دوس مشاركة ⬆، وبعدها «إضافة إلى الشاشة الرئيسية»، وبعدين «إضافة». افتحه بعد كده من الأيقونة عشان يشتغل من غير شريط اللينك.':'في Chrome دوس على التلات نقط ⋮، واختار «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية». افتحه من الأيقونة بعد التثبيت عشان يشتغل من غير شريط اللينك. لو الاختيار مش ظاهر، افتح اللينك في Chrome نفسه مش جوه واتساب.';
  var oldHelp=document.createElement('details'),sum=document.createElement('summary'),q=document.createElement('p');sum.textContent='التطبيق اتثبت عندك قبل كده؟ ولا مش شايف تأكيد التثبيت؟';q.textContent='لو التطبيق كان متسطب عندك قبل كده ومش بيظهر تأكيد التثبيت: دوس مطوّل على الأيقونة القديمة من شاشة الموبايل، واختار إلغاء التثبيت أو إزالة. افتح اللينك تاني في Chrome ودوس تثبيت التطبيق على الموبايل، أو افتح التلات نقط واختار إضافة إلى الشاشة الرئيسية. امسح اختصار التطبيق بس، مش Chrome ولا بيانات المتصفح. الموقع ميقدرش يمسح الأيقونة من موبايلك.';oldHelp.open=true;oldHelp.append(sum,q);
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
 async function installCurrent(){pending=pending||window.__jgInstallPrompt;if(pending){var event=pending;pending=null;window.__jgInstallPrompt=null;try{await event.prompt();var choice=await event.userChoice;if(choice&&choice.outcome==='dismissed')installStatus('التثبيت اتلغى. مفيش حاجة اتثبتت.')}catch(_){installStatus('المتصفح مش موفّر التثبيت دلوقتي.')}}else if(/iPhone|iPad|iPod/.test(navigator.userAgent)||(/Mac/.test(navigator.userAgent)&&navigator.maxTouchPoints>1))instructions();else installStatus(installed?'التطبيق متثبت بالفعل. افتحه من أيقونته على موبايلك.':'افتح لينك التطبيق ده في Chrome نفسه، وبعدها اختار تثبيت التطبيق من التلات نقط ⋮. كل نسخة ليها تثبيت منفصل.');}

 document.addEventListener('click',function(e){var b=e.target.closest('[data-install-app]');if(!b)return;e.preventDefault();if(isAdmin)adminChoices();else installCurrent()});
 if(isAdmin&&new URLSearchParams(location.search).get('install')==='1'){var showAfterAuth=function(){if(!document.getElementById('app').classList.contains('hidden')){adminChoices();return true}return false};if(!showAfterAuth()){var watch=new MutationObserver(function(){if(showAfterAuth())watch.disconnect()});watch.observe(document.getElementById('app'),{attributes:true,attributeFilter:['class']})}}
 var target=document.querySelector('.drawer');if(target&&!document.getElementById('adminInstallButton')){var btn=document.createElement('button');btn.type='button';btn.className='d-link';btn.dataset.installApp='';btn.innerHTML='<svg class="contact-logo" viewBox="0 0 32 32" aria-hidden="true"><rect x="10" y="3" width="12" height="26" rx="3.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M16 9v8m0 0-3.2-3.2M16 17l3.2-3.2" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="16" cy="24" r="1.4" fill="currentColor"/></svg><span>تثبيت التطبيق على الموبايل</span>';btn.style.cssText='font:inherit;text-align:right;border:1px solid #c5d3dd;background:#edf2f6;cursor:pointer';target.appendChild(btn)}
})();

/* Browser back closes the current native in-page dialog before leaving its view. */
(function(){
 if(!window.HTMLDialogElement)return;
 var show=HTMLDialogElement.prototype.showModal,skip=new WeakSet(),serial=0;
 HTMLDialogElement.prototype.showModal=function(){
  if(this.open)return;
  if(!this.id)this.id='jgDialog'+(++serial);
  show.call(this);var dialog=this;
  if(!dialog.dataset.historyReady){dialog.dataset.historyReady='1';dialog.addEventListener('close',function(){if(skip.has(dialog)){skip.delete(dialog);return}if(history.state&&history.state.jgDialog===dialog.id)history.back()})}
  history.pushState(Object.assign({},history.state,{jgDialog:dialog.id}),'',location.href);
 };
 window.addEventListener('popstate',function(e){var wanted=e.state&&e.state.jgDialog;document.querySelectorAll('dialog[open][data-history-ready]').forEach(function(d){if(d.id!==wanted){skip.add(d);d.close()}});var d=wanted&&document.getElementById(wanted);if(d&&d instanceof HTMLDialogElement&&!d.open)show.call(d)});
})();
