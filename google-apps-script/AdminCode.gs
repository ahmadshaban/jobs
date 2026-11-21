function adminPassword_(){return PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD') || '';} 
const SHEET_NAME = 'الوظائف';
const SETTINGS_SHEET_NAME = 'الإعدادات';
const STATUS_COL = 'الحالة';
const PROTECTED_COLS = ['المصنع', 'المنطقة', 'الفئة', 'ظاهر؟', 'الحالة', 'الورديات', 'تاريخ الإضافة'];

function doGet(e) {
  const ss = SpreadsheetApp.getActive();
  if (e && e.parameter && e.parameter.action === 'getSettings') {
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
    if(req.action === 'registerApplicant') return out(registerApplicant_(req.data));

    if (req.action === 'getSettings') {
      return out(cmdGetSettings(ss));
    }

    if (!adminPassword_() || req.password !== adminPassword_()) return out({ ok: false, error: 'كلمة السر غلط' });
    
    if (req.action === 'saveSettings') {
      return out(cmdSaveSettings(ss, req.settings));
    }

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
 * ملحوظة: لو معملتش الخطوة دي خالص، الموقع بيتحدث لوحده كل 3 ساعات
 * من غير أي حاجة منك. السكريبت ده بيطلب تحديث إضافي بعد التعديل.
 ****************************************************/

// التوكن محفوظ في Script Properties، مش في الكود
function jobGateToken_(){return PropertiesService.getScriptProperties().getProperty('GH_TOKEN') || '';}

// الريبو بتاع الموقع
const GH_REPO = 'ahmadshaban/jobs';

function onSheetEdit(e) {
  const GH_TOKEN=jobGateToken_();
  if (!GH_TOKEN) return;
  try {
    UrlFetchApp.fetch('https://api.github.com/repos/' + GH_REPO + '/dispatches', {
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
  } catch (err) { /* لو فشل، الجدولة كل 3 ساعات هتلم التعديل */ }
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
