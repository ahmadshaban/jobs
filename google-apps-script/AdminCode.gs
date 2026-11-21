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

    if (req.action === 'getSettings') {
      return out(cmdGetSettings(ss));
    }

    if (!adminPassword_() || req.password !== adminPassword_()) return out({ ok: false, error: 'كلمة السر غلط' });
    
    if (req.action === 'saveSettings') {
      return out(cmdSaveSettings(ss, req.settings));
    }

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
