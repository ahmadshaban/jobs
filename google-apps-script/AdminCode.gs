function adminPassword_(){return PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD') || '';} 
const SHEET_NAME = 'الوظائف';
const SETTINGS_SHEET_NAME = 'الإعدادات';
const STATUS_COL = 'الحالة';
const PROTECTED_COLS = ['المصنع', 'المنطقة', 'الفئة', 'ظاهر؟', 'الحالة', 'الورديات', 'تاريخ الإضافة'];

function doGet(e) {
  const ss = SpreadsheetApp.getActive();
  if(e && e.parameter && e.parameter.action==='getConfig') return out(dashConfig_());
  if (e && e.parameter && e.parameter.action === 'getSettings') {
    if (!adminPassword_() || String(e.parameter.key || '') !== adminPassword_()) return out({ ok: false, error: 'غير مصرح' });
    return out(cmdGetSettings(ss));
  }
  return out({ ok: true, message: 'الوسيط شغال' });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const ss = SpreadsheetApp.getActive();
    if(req.action==='getConfig') return out(dashConfig_());
    if(req.action === 'registerApplicant') return out(registerApplicant_(req.data));

    const auth=adminAuth_(req);if(!auth.ok)return out(auth);
    
    if (req.action === 'getSettings') {
      return out(cmdGetSettings(ss));
    }

    if (req.action === 'saveSettings') {
      return out(cmdSaveSettings(ss, req.settings));
    }

    if(req.action==='saveConfig') return out(dashSaveConfig_(req.config));
    if(req.action==='changePassword') return out(dashPassword_(req));
    if(req.action==='dashboardStats') return out(dashboardStats_(req));
    if(req.action==='publishSite') return out(dashPublish_());
    if(req.action==='publishStatus') return out(dashPublishStatus_());
    if(req.action === 'listApplicants') return out(listApplicants_());
    if(req.action === 'applicantStatus') return out(statusApplicant_(req));
    const sh = ss.getSheetByName(SHEET_NAME);
    if (!sh) return out({ ok: false, error: 'التبويب مش موجود: ' + SHEET_NAME });
    
    switch (req.action) {
      case 'list':         return out(cmdList(sh));
      case 'add':          return out(cmdAdd(sh, req.data));
      case 'update':       return out(cmdUpdate(sh, req.row, req.data));
      case 'delete':       return out(cmdDelete(sh, req.row));
      case 'addColumn':    return out(cmdAddColumn(sh, req.name));
      case 'deleteColumn': return out(cmdDeleteColumn(sh, req.name));
      default:             return out({ ok: false, error: 'أمر غير معروف' });
    }
  } catch (err) {
    return out({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

function cmdGetSettings(ss) {
  let sh = ss.getSheetByName(SETTINGS_SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SETTINGS_SHEET_NAME);
    sh.appendRow(['مفتَاح_الإعداد', 'القيمة']);
  }
  const lastRow = sh.getLastRow();
  const settings = {};
  if (lastRow > 1) {
    const vals = sh.getRange(2, 1, lastRow - 1, 2).getDisplayValues();
    vals.forEach(function(row) {
      if (row[0]) settings[row[0].trim()] = row[1];
    });
  }
  return { ok: true, settings: settings };
}

function cmdSaveSettings(ss, settingsObj) {
  let sh = ss.getSheetByName(SETTINGS_SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SETTINGS_SHEET_NAME);
    sh.appendRow(['مفتَاح_الإعداد', 'القيمة']);
  }
  if (sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 2).clearContent();
  }
  const rows = [];
  for (const key in settingsObj) {
    if (Object.prototype.hasOwnProperty.call(settingsObj, key)) {
      rows.push([key, settingsObj[key]]);
    }
  }
  if (rows.length > 0) {
    sh.getRange(2, 1, rows.length, 2).setValues(rows);
  }
  onSheetEdit(); return { ok: true };
}

function cmdList(sh) {
  const headers = getHeaders(sh);
  if (headers.indexOf(STATUS_COL) < 0) {
    sh.getRange(1, headers.length + 1).setValue(STATUS_COL);
    headers.push(STATUS_COL);
  }
  const lastRow = sh.getLastRow();
  const rows = [];
  if (lastRow > 1) {
    const vals = sh.getRange(2, 1, lastRow - 1, headers.length).getDisplayValues();
    vals.forEach(function (v, i) {
      if (v.some(function (x) { return String(x).trim() !== ''; })) rows.push({ row: i + 2, values: v });
    });
  }
  return { ok: true, headers: headers, rows: rows };
}

function cmdAdd(sh, data) {
  const headers = getHeaders(sh);
  const row = headers.map(function (h) { return data && data[h] !== undefined ? data[h] : ''; });
  sh.appendRow(row);
  onSheetEdit(); return { ok: true };
}

function cmdUpdate(sh, rowNum, data) {
  const n = checkRow(sh, rowNum);
  if (!n) return { ok: false, error: 'رقم الصف غلط' };
  const headers = getHeaders(sh);
  headers.forEach(function (h, i) {
    if (data && Object.prototype.hasOwnProperty.call(data, h)) sh.getRange(n, i + 1).setValue(data[h]);
  });
  onSheetEdit(); return { ok: true };
}

function cmdDelete(sh, rowNum) {
  const n = checkRow(sh, rowNum);
  if (!n) return { ok: false, error: 'رقم الصف غلط' };
  sh.deleteRow(n);
  onSheetEdit(); return { ok: true };
}

function cmdAddColumn(sh, name) {
  const nm = String(name || '').trim();
  if (!nm) return { ok: false, error: 'الاسم فاضي' };
  const headers = getHeaders(sh);
  if (headers.indexOf(nm) >= 0) return { ok: false, error: 'العمود موجود قبل كده' };
  sh.getRange(1, headers.length + 1).setValue(nm);
  onSheetEdit(); return { ok: true };
}

function cmdDeleteColumn(sh, name) {
  const nm = String(name || '').trim();
  if (!nm) return { ok: false, error: 'الاسم فاضي' };
  if (PROTECTED_COLS.indexOf(nm) >= 0) return { ok: false, error: 'العمود ده أساسي ومش بيتمسح: ' + nm };
  const headers = getHeaders(sh);
  const i = headers.indexOf(nm);
  if (i < 0) return { ok: false, error: 'العمود مش موجود: ' + nm };
  sh.deleteColumn(i + 1);
  onSheetEdit(); return { ok: true };
}

function getHeaders(sh) {
  const c = sh.getLastColumn();
  if (!c) return [];
  return sh.getRange(1, 1, 1, c).getDisplayValues()[0].map(function (h) { return String(h).trim(); });
}

function checkRow(sh, rowNum) {
  const n = Number(rowNum);
  if (!Number.isInteger(n) || n < 2 || n > sh.getLastRow()) return 0;
  return n;
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}/****************************************************
 * بوابة الوظائف — تحديث الموقع فورًا أول ما تعدّل الشيت
 *
 * السكريبت ده بيبعت إشارة لـ GitHub تعمل بناء جديد للموقع
 * بعد تعديل الشيت حسب وقت تشغيل GitHub Actions.
 *
 * التركيب (مرة واحدة بس):
 * 1) من شيت الوظايف: Extensions ← Apps Script
 * 2) أضف الكود ده من غير مسح كود المشروع الموجود
 * 3) اعمل توكن GitHub (خطواتها في ملف التعليمات) واحفظه في Script Properties باسم GH_TOKEN
 * 4) من القايمة الشمال: ⏰ Triggers ← Add Trigger:
 *    - الدالة: onSheetEdit
 *    - Event source: From spreadsheet
 *    - Event type: On edit
 * 5) سيب باقي الإعدادات زي ما هي واضغط Save
 *
 * ملحوظة: نتيجة كل طلب تحديث بتتسجل في Script Properties تحت LAST_DISPATCH،
 * و«مراجعة حالة النشر» في لوحة الأدمن بتعرضها. لو طلب التحديث ما وصلش،
 * اللوحة هتنبّهك وتقدر تعيد الطلب من زرار «نشر التغييرات».
 ****************************************************/

// التوكن محفوظ في Script Properties، مش في الكود
function jobGateToken_(){return PropertiesService.getScriptProperties().getProperty('GH_TOKEN') || '';}

// الريبو بتاع الموقع
const GH_REPO = 'ahmadshaban/jobs';

function recordDispatch_(ok, error) {
  try {
    const stamp = Utilities.formatDate(new Date(), 'Africa/Cairo', 'yyyy-MM-dd HH:mm');
    PropertiesService.getScriptProperties().setProperty('LAST_DISPATCH', JSON.stringify({ at: stamp, ok: !!ok, error: String(error || '').slice(0, 180) }));
  } catch (x) {}
}

function dispatchPublish_() {
  const GH_TOKEN=jobGateToken_();
  if (!GH_TOKEN) return { ok: false, error: 'مفتاح الربط مع جيت هاب مش محفوظ' };
  try {
    const resp = UrlFetchApp.fetch('https://api.github.com/repos/' + GH_REPO + '/dispatches', {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'Authorization': 'Bearer ' + GH_TOKEN,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      payload: JSON.stringify({ event_type: 'sheet-edit' }),
      muteHttpExceptions: true
    });
    const code = resp.getResponseCode();
    return code === 204 ? { ok: true } : { ok: false, error: 'جيت هاب رد بكود ' + code };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

function onSheetEdit(e) {
  const r = dispatchPublish_();
  recordDispatch_(r.ok, r.error);
}

function installJobGateTrigger(){var ss=SpreadsheetApp.openById('1UXAwDfIn3oxU68byv1I6dIrdQaKm2OXhhj7NoHlwRBU');if(!ScriptApp.getProjectTriggers().some(function(t){return t.getHandlerFunction()==='onSheetEdit'}))ScriptApp.newTrigger('onSheetEdit').forSpreadsheet(ss).onEdit().create();}

// Private forward-only website leads. A WhatsApp handoff is not a verified send.
const AP_HEADERS=['id','created_at','created_cairo','name','age','phone','job','area','shift','salary','source','status','start_date','updated_at','whatsapp'];
const AP_STATUSES=['جديد','استلم','هيستلم','ما عجبوش الشغل','مشي','ما كملش','مش بيرد'];
function initApplicantRegister(){
 const p=PropertiesService.getScriptProperties();let id=p.getProperty('APPLICANTS_SHEET_ID');
 if(!id){const ss=SpreadsheetApp.create('Job Gate - سجل المتقدمين الخاص');ss.setSpreadsheetTimeZone('Africa/Cairo');const sh=ss.getSheets()[0];sh.setName('المتقدمين');sh.appendRow(AP_HEADERS);sh.setFrozenRows(1);sh.getRange('A:O').setNumberFormat('@');id=ss.getId();p.setProperty('APPLICANTS_SHEET_ID',id);}
 console.log(SpreadsheetApp.openById(id).getUrl());return id;
}
function applicantSheet_(){const id=PropertiesService.getScriptProperties().getProperty('APPLICANTS_SHEET_ID');if(!id)throw new Error('سجل المتقدمين لسه مش جاهز');return SpreadsheetApp.openById(id).getSheetByName('المتقدمين');}
function apText_(x,n){return String(x==null?'':x).replace(/[\u0000-\u001f]/g,' ').trim().slice(0,n||160);}
function apSafe_(x){x=String(x==null?'':x);return /^[=+@\-]/.test(x)?"'"+x:x;}
function apPhone_(p){p=String(p||'').replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/\D/g,'');if(p.startsWith('0020'))p=p.slice(2);if(p.startsWith('20'))p='0'+p.slice(2);if(!/^01[0125]\d{8}$/.test(p))return '';return '2'+p;}
function apRows_(){const s=applicantSheet_();return s.getLastRow()<2?[]:s.getRange(2,1,s.getLastRow()-1,AP_HEADERS.length).getDisplayValues();}
function registerApplicant_(d){
 d=d||{};const cache=CacheService.getScriptCache(),minute='ap:'+Math.floor(Date.now()/60000),count=Number(cache.get(minute)||0);if(count>=90)return {ok:false,error:'طلبات كتير دلوقتي، جرّب بعد دقيقة'};cache.put(minute,String(count+1),70);if(d.website)return {ok:false,error:'تعذر التسجيل'};
 const id=apText_(d.id,80),name=apText_(d.name,100),phone=apPhone_(d.phone),age=Number(d.age),job=apText_(d.job,160);
 if(!/^[A-Za-z0-9_-]{16,80}$/.test(id)||name.length<3||!phone||!Number.isInteger(age)||age<16||age>60||!job)return {ok:false,error:'راجع الاسم والسن ورقم الواتساب'};
 if(dashConfig_().config.maintenance==='true')return {ok:false,error:'التقديم متوقف مؤقتًا'};
 const now=new Date(),all=apRows_();
 const prior=all.find(r=>r[0]===id||(r[5]===phone&&r[6]===job&&(now.getTime()-new Date(r[1]).getTime())<86400000));
 if(prior)return {ok:true,id:prior[0],duplicate:true,unconfirmed:true};
 const row=[id,now.toISOString(),Utilities.formatDate(now,'Africa/Cairo','yyyy-MM-dd HH:mm:ss'),name,String(age),phone,job,apText_(d.area),apText_(d.shift),apText_(d.salary),apText_(d.source,80),'جديد','',now.toISOString(),'غير مؤكد'];
 applicantSheet_().appendRow(row.map(apSafe_));return {ok:true,id:id,unconfirmed:true};
}
function listApplicants_(){const rows=apRows_().map(r=>Object.fromEntries(AP_HEADERS.map((k,i)=>[k,r[i]])));return {ok:true,rows:rows,timezone:'Africa/Cairo'};}
function statusApplicant_(req){
 const status=apText_(req.status,40),day=apText_(req.start_date,10);if(!AP_STATUSES.includes(status))return {ok:false,error:'الحالة مش صحيحة'};
 if(status==='هيستلم'&&(!/^\d{4}-\d{2}-\d{2}$/.test(day)||isNaN(new Date(day+'T12:00:00Z').getTime())||new Date(day+'T12:00:00Z').toISOString().slice(0,10)!==day))return {ok:false,error:'اختار تاريخ الاستلام'};
 const all=apRows_(),i=all.findIndex(r=>r[0]===req.id);if(i<0)return {ok:false,error:'المتقدم مش موجود'};
 applicantSheet_().getRange(i+2,12,1,3).setValues([[status,status==='هيستلم'?day:'',new Date().toISOString()]]);return {ok:true};
}

const DASH_DEFAULTS={"company_name": "First Service للتوظيف", "site_name": "بوابة الوظائف", "cc_site_name": "Job Gate CC", "whatsapp": "201095237207", "brand_color": "#0E5A40", "font_family": "Tajawal", "font_size": "14", "followup_template": "السلام عليكم أستاذ {name}،\nمعاك أحمد من شركة {company}. انت كنت قدمت على وظيفة {job} عندنا، وبتابع معاك: استلمت ولا في أي مشاكل؟", "application_template": "الاسم: {name}\nالسن: {age}\nرقم الواتساب: {phone}\nالمكان: {area}\nالمصنع: {job}\nالوردية: {shift}\nالمرتب: {salary}", "cc_application_template": "السلام عليكم، محتاج التفاصيل عن وظيفة مسوق بالعمولة (فريق التوظيف أونلاين)\nالاسم: {name}\nالسن: {age}\nرقم الواتساب: {phone}\nاشتغلت الشغل ده قبل كده: {experience}\nالشركة: {previous_company}", "question_template": "السلام عليكم، عندي استفسار بخصوص الوظايف", "age_below": "سنك أصغر من المطلوب، أقل سن للتقديم {min} سنة", "age_above": "سنك أكبر من المطلوب، أكبر سن للتقديم {max} سنة", "age_invalid": "اكتب السن بالأرقام", "name_invalid": "لازم تكتب اسمك ثلاثي", "phone_invalid": "الرقم ناقص، اكتب رقم واتساب مصري صحيح", "shift_required": "لازم تختار الوردية", "handoff_hint": "واتساب هيفتح برسالتك جاهزة. دوس إرسال هناك عشان طلبك يوصل.", "consent_text": "لما تدوس زرار فتح واتساب، اسمك وسنك ورقمك والوظيفة ووقت التسجيل هيتحفظوا في سجل خاص لدى Job Gate للمتابعة. إرسال رسالة واتساب بيتم بإيدك.", "save_failure": "تعذر تأكيد حفظ بياناتك. جرّب الحفظ تاني، أو افتح واتساب من غير حفظ. رسالة واتساب لسه ما اتبعتتش.", "home_heading": "📍 اختار منطقتك", "question_label": "💬 اسأل على الواتساب", "apply_label": "قدّم دلوقتي", "confirm_title": "متأكد من البيانات اللي أنت دخلتها؟", "confirm_continue": "آه متأكد، كمل على الواتساب", "confirm_back": "لا، ثواني هرجع أتأكد تاني", "transport_title": "🚌 مهم قبل التقديم", "cc_heading": "اشتغلي أونلاين من موبايلك", "cc_job_title": "مسوّقة في فريق التوظيف", "maintenance": "false", "maintenance_text": "التقديم متوقف مؤقتًا، جرّب تاني بعد شوية.", "transport_notice": "▸ لو مكانك خارج {area}، المواصلات لحد نقطة التجمع جوه {area} على حسابك الشخصي، ومن نقطة التجمع عربيات المصنع بتاخدك."};

function dashConfig_(){let stored={};try{stored=JSON.parse(PropertiesService.getScriptProperties().getProperty('DASH_CONFIG')||'{}')}catch(e){}const config={};Object.keys(DASH_DEFAULTS).forEach(k=>config[k]=typeof stored[k]==='string'?stored[k]:DASH_DEFAULTS[k]);return {ok:true,config:config,updated_at:PropertiesService.getScriptProperties().getProperty('DASH_CONFIG_AT')||''};}
function dashSaveConfig_(data){
 if(!data||typeof data!=='object')return {ok:false,error:'الإعدادات ناقصة'};
 const config=dashConfig_().config;
 for(const k of Object.keys(data)){if(!(k in DASH_DEFAULTS))return {ok:false,error:'إعداد غير معروف'};if(typeof data[k]!=='string'||data[k].length>4000)return {ok:false,error:'قيمة الإعداد طويلة أو غير صحيحة'};config[k]=data[k].trim();}
 const phone=apPhone_(config.whatsapp);if(!phone)return {ok:false,error:'رقم واتساب مصري صحيح مطلوب'};config.whatsapp=phone;
 if(!config.site_name||!config.company_name||!config.cc_site_name)return {ok:false,error:'اكتب اسم الموقع والشركة'};
 if(!/^#[0-9a-fA-F]{6}$/.test(config.brand_color)||!['Tajawal','Cairo','Arial','Tahoma'].includes(config.font_family)||!['13','14','15','16','17','18'].includes(config.font_size))return {ok:false,error:'راجع اللون والخط والحجم'};
 for(const k of ['followup_template','application_template','cc_application_template','age_below','age_above','handoff_hint','consent_text','maintenance_text'])if(!config[k])return {ok:false,error:'نص أساسي فاضي: '+k};
 if(!config.application_template.includes('{name}')||!config.application_template.includes('{phone}')||!config.application_template.includes('{job}'))return {ok:false,error:'رسالة التقديم لازم تشمل {name} و{phone} و{job}'};
 if(!config.followup_template.includes('{job}'))return {ok:false,error:'رسالة المتابعة لازم تشمل {job}'};
 const raw=JSON.stringify(config);if(Utilities.newBlob(raw).getBytes().length>8500)return {ok:false,error:'إجمالي النصوص كبير، قصّر النصوص'};
 const p=PropertiesService.getScriptProperties(),old=p.getProperty('DASH_CONFIG');if(old)p.setProperty('DASH_CONFIG_PREVIOUS',old);p.setProperty('DASH_CONFIG',raw);p.setProperty('DASH_CONFIG_AT',new Date().toISOString());return {ok:true,config:config,needs_publish:true};
}
function dashPassword_(req){const current=String(req.current_password||''),next=String(req.new_password||'');if(current!==adminPassword_())return {ok:false,error:'كلمة السر الحالية غلط'};if(next.length<8||next.length>128)return {ok:false,error:'كلمة السر من 8 إلى 128 حرف'};PropertiesService.getScriptProperties().setProperty('ADMIN_PASSWORD',next);return {ok:true};}
function dashPublish_(){const token=jobGateToken_();if(!token)return {ok:false,error:'نشر الموقع غير متاح، افتح GitHub من المساعدة'};const r=dispatchPublish_();recordDispatch_(r.ok,r.error);return r.ok?{ok:true,queued:true}:{ok:false,error:'تعذر طلب النشر، راجع GitHub'+(r.error?' ('+r.error+')':'')};}
function dashPublishStatus_(){const token=jobGateToken_(),r=UrlFetchApp.fetch('https://api.github.com/repos/'+GH_REPO+'/actions/workflows/build-site.yml/runs?per_page=1',{headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json'},muteHttpExceptions:true});if(r.getResponseCode()!==200)return {ok:false,error:'تعذر قراءة حالة النشر'};const run=JSON.parse(r.getContentText()).workflow_runs[0];let dispatch=null;try{dispatch=JSON.parse(PropertiesService.getScriptProperties().getProperty('LAST_DISPATCH')||'null')}catch(e){}return {ok:true,run:run?{status:run.status,conclusion:run.conclusion,url:run.html_url,updated_at:run.updated_at}:null,dispatch:dispatch};}

function dashboardAnalyticsSheet_(){return SpreadsheetApp.openById('1xe0p2arTa_jN78H0pgucMr721PZZvxs9TAXVIwIL0T8').getSheetByName('log');}
const DASH_TZ='Africa/Cairo';
function dashboardStats_(p) {
  var days = Math.min(Math.max(parseInt(p.days, 10) || 30, 1), 365);
  var cache = CacheService.getScriptCache(), key = 'dashboard-st' + days;
  var hit = cache.get(key);
  if (hit) return JSON.parse(hit);

  var sh = dashboardAnalyticsSheet_(), last = sh.getLastRow();
  var rows = last > 1 ? sh.getRange(2, 1, last - 1, 9).getValues() : [];
  var now = new Date();
  var list = [], idx = {};
  for (var i = days - 1; i >= 0; i--) {
    var d = Utilities.formatDate(new Date(now.getTime() - i * 86400000), DASH_TZ, 'yyyy-MM-dd');
    idx[d] = list.length;
    list.push({ d: d, visit: 0, view: 0, apply: 0, send: 0, call: 0, share: 0, u: 0 });
  }
  var tot = { visit: 0, view: 0, apply: 0, send: 0, call: 0, share: 0 };
  var uniq = {}, dayU = {}, fac = {}, area = {}, src = {}, hours = [], k;
  for (k = 0; k < 24; k++) hours.push(0);

  rows.forEach(function (r) {
    var d = r[1] instanceof Date ? Utilities.formatDate(r[1], DASH_TZ, 'yyyy-MM-dd') : String(r[1]);
    if (!(d in idx)) return;
    var t = r[3], f = r[4], a = r[5], s = r[6], v = r[8];
    list[idx[d]][t]++; tot[t]++;
    if (v) { uniq[v] = 1; (dayU[d] = dayU[d] || {})[v] = 1; }
    if (t === 'visit') { hours[+r[2] || 0]++; var sk = s || 'مباشر'; (src[sk] = src[sk] || { s: sk, visit: 0, apply: 0, send: 0 }).visit++; }
    if (f) {
      var o = fac[f] = fac[f] || { f: f, r: a, view: 0, apply: 0, send: 0, call: 0 };
      if (o[t] !== undefined) o[t]++;
      if (a && !o.r) o.r = a;
    }
    if (a) {
      var ar = area[a] = area[a] || { a: a, view: 0, apply: 0, send: 0 };
      if (ar[t] !== undefined) ar[t]++;
    }
    if ((t === 'apply' || t === 'send') && s) {
      var sx = src[s] = src[s] || { s: s, visit: 0, apply: 0, send: 0 };
      sx[t]++;
    }
  });
  list.forEach(function (x) { x.u = dayU[x.d] ? Object.keys(dayU[x.d]).length : 0; });
  var vals = function (o) { return Object.keys(o).map(function (z) { return o[z]; }); };
  var res = {
    ok: true, days: days, list: list, tot: tot, uniq: Object.keys(uniq).length,
    factories: vals(fac).sort(function (x, y) { return (y.send - x.send) || (y.apply - x.apply) || (y.view - x.view); }).slice(0, 30),
    areas: vals(area).sort(function (x, y) { return (y.send - x.send) || (y.apply - x.apply) || (y.view - x.view); }),
    srcs: vals(src).sort(function (x, y) { return (y.send - x.send) || (y.apply - x.apply) || (y.visit - x.visit); }).slice(0, 15),
    hours: hours, at: Utilities.formatDate(now, DASH_TZ, 'yyyy-MM-dd HH:mm')
  };
  try { cache.put(key, JSON.stringify(res), 60); } catch (e) {}
  return res;
}


// Device-scoped, time-limited gate for protected admin actions.
function adminAuth_(req){
 if(adminPassword_()&&req.password===adminPassword_())return {ok:true};
 return {ok:false,error:'كلمة السر غلط'};
}
