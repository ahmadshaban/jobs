// ===== [1] الإعدادات =====
function statsPassword_(){return PropertiesService.getScriptProperties().getProperty('STATS_PASSWORD') || '';}  // <<< غيّر هنا: باسورد صفحة الإحصائيات
const TZ = 'Africa/Cairo';
const TYPES = ['visit', 'view', 'apply', 'send', 'call', 'share']; // زيارة، فتح مصنع، ضغط قدّم، إرسال واتساب، اتصال، مشاركة

// ===== [2] الاستقبال =====
function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    if (p.a === 'log') { logEvent_(p); return out_({ ok: true }); }
    if (p.a === 'stats') return out_(getStats_(p));
    return out_({ ok: true, msg: 'stats ready' });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  }
}
function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// ===== [3] الشيت (بيتعمل لوحده أول مرة) =====
function sheet_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SID'), ss;
  if (id) { ss = SpreadsheetApp.openById(id); }
  else {
    ss = SpreadsheetApp.create('إحصائيات موقع الوظائف');
    props.setProperty('SID', ss.getId());
  }
  var sh = ss.getSheetByName('log');
  if (!sh) {
    sh = ss.getSheets()[0]; sh.setName('log');
    sh.appendRow(['الوقت', 'اليوم', 'الساعة', 'النوع', 'المصنع', 'المنطقة', 'المصدر', 'الصفحة', 'الزائر']);
    sh.setFrozenRows(1);
  }
  return sh;
}
// شغّلها مرة من المحرر عشان تاخد الإذن وتعرف رابط الشيت
function setup() { Logger.log(sheet_().getParent().getUrl()); }

// ===== [4] تسجيل حدث =====
function logEvent_(p) {
  var t = String(p.t || '');
  if (TYPES.indexOf(t) < 0) return;
  var c = function (x) { return String(x || '').replace(/[\r\n]/g, ' ').trim().slice(0, 80); };
  var now = new Date();
  var row = [
    Utilities.formatDate(now, TZ, 'yyyy-MM-dd HH:mm:ss'),
    Utilities.formatDate(now, TZ, 'yyyy-MM-dd'),
    +Utilities.formatDate(now, TZ, 'H'),
    t, c(p.f), c(p.r), c(p.s), c(p.p), c(p.v)
  ];
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try { sheet_().appendRow(row); } finally { lock.releaseLock(); }
  CacheService.getScriptCache().removeAll(['st1', 'st7', 'st30', 'st90']);
}

// ===== [5] الأرقام =====
function getStats_(p) {
  if (!statsPassword_() || String(p.p || '') !== statsPassword_()) return { ok: false, error: 'الباسورد غلط' };
  var days = Math.min(Math.max(parseInt(p.days, 10) || 30, 1), 365);
  var cache = CacheService.getScriptCache(), key = 'st' + days;
  var hit = cache.get(key);
  if (hit) return JSON.parse(hit);

  var sh = sheet_(), last = sh.getLastRow();
  var rows = last > 1 ? sh.getRange(2, 1, last - 1, 9).getValues() : [];
  var now = new Date();
  var list = [], idx = {};
  for (var i = days - 1; i >= 0; i--) {
    var d = Utilities.formatDate(new Date(now.getTime() - i * 86400000), TZ, 'yyyy-MM-dd');
    idx[d] = list.length;
    list.push({ d: d, visit: 0, view: 0, apply: 0, send: 0, call: 0, share: 0, u: 0 });
  }
  var tot = { visit: 0, view: 0, apply: 0, send: 0, call: 0, share: 0 };
  var uniq = {}, dayU = {}, fac = {}, area = {}, src = {}, hours = [], k;
  for (k = 0; k < 24; k++) hours.push(0);

  rows.forEach(function (r) {
    var d = r[1] instanceof Date ? Utilities.formatDate(r[1], TZ, 'yyyy-MM-dd') : String(r[1]);
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
    hours: hours, at: Utilities.formatDate(now, TZ, 'yyyy-MM-dd HH:mm')
  };
  try { cache.put(key, JSON.stringify(res), 60); } catch (e) {}
  return res;
}
