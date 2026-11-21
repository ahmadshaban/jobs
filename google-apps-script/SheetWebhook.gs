/****************************************************
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
