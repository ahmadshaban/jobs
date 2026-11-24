/* Sharing and image export, no network dependency. */
(function(){
var controls=document.querySelector('[data-share-tools]');if(!controls)return;
var title=controls.getAttribute('data-title')||'بوابة الوظايف';
var records=[];try{records=JSON.parse(controls.getAttribute('data-records')||'[]')}catch(e){}
function message(m){var n=document.getElementById('shareStatus');if(n)n.textContent=m}
function copy(txt){
 if(navigator.clipboard&&navigator.clipboard.writeText)return navigator.clipboard.writeText(txt).then(function(){message('اتنسخ ✅')},function(){manual(txt)});
 manual(txt);
}
function manual(txt){var d=document.createElement('dialog');d.className='cfov';var b=document.createElement('div');b.className='cfsheet';var p=document.createElement('p');p.textContent='اضغط مطوّل على النص وحدد الكل وانسخ';var ta=document.createElement('textarea');ta.value=txt;ta.style.cssText='width:100%;min-height:220px;font:inherit';var x=document.createElement('button');x.className='btn btn-ghost2';x.textContent='✕ قفل';x.setAttribute('aria-label','قفل');function shut(){d.remove();window.removeEventListener('popstate',shut)}x.onclick=function(){history.back()};history.pushState({jgShare:true},'',location.href);window.addEventListener('popstate',shut);b.append(p,ta,x);d.appendChild(b);document.body.appendChild(d);d.showModal()}
function pageLink(){return controls.getAttribute("data-link")||location.origin+location.pathname+location.search}
function logShare(){try{if(window.jgTrack){var jm=document.getElementById('jobMeta');window.jgTrack('share',jm?jm.getAttribute('data-factory')||'':'',jm?jm.getAttribute('data-area')||'':'')}}catch(e){}}
function text(){return records.map(function(r){return r.text}).join('\n\n────────────────\n\n')}
async function canvasFor(r){
 await document.fonts.ready;
 var c=document.createElement('canvas'),ctx=c.getContext('2d');c.width=1080;c.height=2400;
 ctx.font='600 29px Tajawal, Tahoma, Arial';ctx.direction='rtl';ctx.textAlign='right';
 var lines=[];String(r.text||'').split('\n').forEach(function(line){var words=line.split(/\s+/),current='';words.forEach(function(w){var next=current?current+' '+w:w;if(ctx.measureText(next).width>930&&current){lines.push(current);current=w}else current=next});lines.push(current)});
 c.height=Math.max(700,200+lines.length*54);ctx.fillStyle='#ffffff';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#0E5A40';ctx.fillRect(0,0,c.width,115);ctx.direction='rtl';ctx.textAlign='right';ctx.font='800 38px Tajawal, Tahoma, Arial';ctx.fillStyle='#fff';ctx.fillText('بوابة الوظايف',1008,73);ctx.fillStyle='#172F40';ctx.font='600 29px Tajawal, Tahoma, Arial';lines.forEach(function(l,i){ctx.fillText(l,1008,180+i*54)});
 return c;
}
async function exportAll(share){
 message('بجهز الصور…');var gallery=document.getElementById('shareGallery');gallery.replaceChildren();
 for(var i=0;i<records.length;i++){
  var c=await canvasFor(records[i]),blob=await new Promise(function(ok){c.toBlob(ok,'image/png')}),url=URL.createObjectURL(blob);
  var image=document.createElement('img');image.src=url;image.alt=records[i].name;image.style.cssText='display:block;width:100%;border:1px solid #ddd;border-radius:12px;margin-top:10px';gallery.appendChild(image);
  var a=document.createElement('a');a.href=url;a.download='job-'+(i+1)+'.png';a.className='btn btn-ghost2';a.textContent='احفظ صورة '+records[i].name;gallery.appendChild(a);
  if(share&&records.length===1&&navigator.canShare){var f=new File([blob],'job.png',{type:'image/png'});if(navigator.canShare({files:[f]})){try{await navigator.share({files:[f],title:title});message('اتفتحت اختيارات المشاركة');return}catch(e){if(e.name==='AbortError'){message('المشاركة اتلغت');return}}}}
 }
 message(records.length>1?'الصور جاهزة، احفظ كل صورة من الزرار اللي تحتها':'الصورة جاهزة');
}
controls.addEventListener('click',async function(e){var b=e.target.closest('[data-share]');if(!b)return;var op=b.getAttribute('data-share');try{
 if(op==='link'){copy(pageLink());logShare()}
 if(op==='text'){copy(text());logShare()}
 if(op==='image')await exportAll(false)
 if(op==='share-image')await exportAll(true)
 if(op==='share'){var shared=false;if(navigator.share){try{await navigator.share({title:title,text:text(),url:pageLink()});message('اتفتحت اختيارات المشاركة');shared=true}catch(err){if(err.name==='AbortError')message('المشاركة اتلغت');else{manual(text());shared=true}}}else{manual(text());shared=true}if(shared)logShare()}
}catch(err){message('التجهيز ماكملش، جرب تاني أو انسخ النص')}});
})();
