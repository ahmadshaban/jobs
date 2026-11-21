# -*- coding: utf-8 -*-
"""مولّد موقع بوابة الوظائف: صفحات ثابتة SEO من الشيت مباشرة.
يشتغل محلي وعلى GitHub Actions. مفيش أي جافاسكريبت لجلب البيانات في الصفحات."""
import datetime, html, json, os, re, shutil, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from data import (SHEET_ID, PHONE, SITE_BASE, SITE_NAME, SITE_NAME_CC,
                  fetch_csv, load_jobs, visible_jobs, sort_jobs, group_by_city,
                  city_name, city_slug, job_id, is_done, is_urgent, is_new, is_daily,
                  parse_shifts, parse_contacts, pays, pay_score, hours_only, num_of)

OUT = os.environ.get("OUT_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "site"))
TODAY = datetime.date.today()
SHOW_APPLY_FORM = False  # لو عايز الزرار يفتح الفورم بدل ما تكون ظاهرة: خليها False
APPLY_FLOW_PAGE = True  # "قدّم دلوقتي" يفتح صفحة فورم مستقلة
STATS_URL = "https://script.google.com/macros/s/AKfycbwr_pFD5PMl-cSyBS6vFf-Pa_Mr8pc_zxHUxPfHHjAWtkwME0iIEBPwvvm0cOjn_f4f/exec"

def esc(s): return html.escape(str(s or ""), quote=True)

def city_base(j):
    c = city_name(j)
    import data
    for pat, slug, canon in data.CITY_SLUGS:
        if re.search(pat, c):
            return canon
    return c

def city_of(j):
    c = city_name(j)
    import data
    for pat, slug, canon in data.CITY_SLUGS:
        if re.search(pat, c):
            c = canon
            break
    if "قبض يومي" in str(j.get("المنطقة") or ""):
        c = c + " - قبض يومي"
    return c

def age_range(j):
    """يستخرج حدود السن من النص الحر في الشيت (زي: من18ل50 / 16_45). None لو مفيش حدود."""
    t = str(j.get("السن") or "")
    nums = [int(x) for x in re.findall(r"\d+", t)]
    nums = [n for n in nums if 10 <= n <= 80]
    if len(nums) >= 2:
        lo, hi = nums[0], nums[1]
        if lo < hi:
            return lo, hi
    return None

def salary_line(j):
    p = pays(j)
    if p: return " | ".join(f"{t}: {v}" for t, v in p)
    return j.get("المرتب") or ""

def best_salary_num(j):
    n = pay_score(j)
    return int(n) if n else 0

def tags_html(j):
    t = []
    if is_daily(j): t.append('<span class="tag daily">💵 قبض يومي</span>')
    if is_urgent(j): t.append('<span class="tag hot">🔥 الأكثر تقديمًا</span>')
    if is_new(j, TODAY): t.append('<span class="tag new">✨ جديد</span>')
    return '<div class="tags">' + "".join(t) + '</div>' if t else ""

def wa_apply_link(j, shifts_line=None):
    """لينك واتساب جاهز برسالة فيها بيانات الوظيفة (الفورم يكمّل الاسم والسن والرقم)."""
    lines = ["السلام عليكم، عايز أقدم على الوظيفة دي:",
             "📍 *المكان:* " + j.get("المنطقة", ""),
             "🏭 *المصنع:* " + j.get("المصنع", "")]
    sal = salary_line(j).replace(" في الشهر", "")
    if sal: lines.append("💰 *المرتب:* " + sal)
    import urllib.parse
    return "https://wa.me/" + PHONE + "?text=" + urllib.parse.quote("\n".join(lines))

def layout(title, desc, body, prefix, variant, canonical, json_ld=None, noindex=False, og_title=None, page_cls=""):
    name = SITE_NAME_CC if variant == "cc" else SITE_NAME
    if variant == "cc":
        for ph in ["+"+PHONE,PHONE,"0"+PHONE[2:]]:
            body=body.replace(ph,"")
    robots = '<meta name="robots" content="noindex,nofollow">' if noindex else ""
    ld = f'<script type="application/ld+json">{json.dumps(json_ld, ensure_ascii=False)}</script>' if json_ld else ""
    return f"""<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
{robots}
<link rel="canonical" href="{esc(canonical)}">
<meta property="og:title" content="{esc(og_title or title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="{esc(canonical)}">
<meta property="og:locale" content="ar_EG">
<meta property="og:site_name" content="{esc(name)}">
<meta name="theme-color" content="#0E5A40">
<link rel="manifest" href="{prefix}manifest.json">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800;900&display=swap">
<link rel="stylesheet" href="{prefix}style.css">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏭</text></svg>">
{ld}
</head>
<body class="{page_cls}" data-variant="{variant}" data-prefix="{prefix}">
{body}
<script src="{prefix}app.js" defer></script>
<script src="{prefix}sharing.js" defer></script>
<script src="{prefix}legacy.js" defer></script>
<script src="{prefix}pwa.js" defer></script>
</body>
</html>"""

def header(prefix, variant):
    name = SITE_NAME_CC if variant == "cc" else SITE_NAME
    home = prefix + "index.html"
    drawer_links = ""
    if variant != "cc":
        drawer_links = f"""<div class="d-sep"></div>
<a class="d-link" href="{prefix}admin.html">🔒 الأدمن</a>
<a class="d-link" href="{prefix}stats.html">📊 الإحصائيات</a>
<a class="d-link" href="{prefix}cc-jobs/">📢 وظايف كول سنتر للبنات</a>
"""
    return f"""<header class="top"><div class="wrap">
<div class="logo">🏭</div>
<h1 class="brand"><a href="{home}">{esc(name)}</a></h1>
<span class="badge-live"><span class="dot"></span> متاحة دلوقتي</span>
<button class="menu-btn" id="menuBtn" type="button" aria-label="القايمة">☰</button>
</div></header>
<div class="scrim" id="scrim"></div>
<nav class="drawer" id="drawer" aria-label="القايمة">
<div class="d-head"><span>🏭 {esc(name)}</span><button type="button" id="drawerClose" aria-label="قفل">✕</button></div>
<a class="d-link" href="{home}">🏠 الرئيسية</a>{drawer_links}
</nav>"""

def steps_strip():
    return """<div class="wrap"><div class="steps">
<div class="step"><span class="n">1</span>اختار<b>منطقتك</b></div>
<div class="step"><span class="n">2</span>اختار<b>الوظيفة</b></div>
<div class="step"><span class="n">3</span>دوس<b>قدّم 💬</b></div>
</div></div>"""

def job_card(j, prefix):
    sal = salary_line(j).replace(" في الشهر", "")
    main_sal = (pays(j)[0][1] if pays(j) else (j.get("المرتب") or "")).replace(" في الشهر", "")
    alt_sal = (pays(j)[1][1] if len(pays(j)) > 1 else "").replace(" في الشهر", "")
    sal_html = ""
    if main_sal:
        sal_html = f'<div class="sal"><b>{esc(main_sal)}</b>'
        if alt_sal: sal_html += f'<small>أو {esc(alt_sal)} (26 يوم + 4 إجازة)</small>'
        elif "يوم" in (j.get("المرتب") or "") or is_daily(j): sal_html += '<small>اليومية</small>'
        else: sal_html += '<small>في الشهر</small>'
        sal_html += '</div>'
    url = f"{prefix}jobs/{j.get('__jid') or job_id(j)}/"
    cat = "b" if ("بنات" in j.get("الفئة","") and "شباب" in j.get("الفئة","")) else ("g" if "بنات" in j.get("الفئة","") else "m")
    return f"""<a class="job" data-cat="{cat}" href="{url}">
<div class="ttl"><h3>{esc(j.get('المصنع'))}</h3></div>
<div class="meta"><span>📍 {esc(city_base(j))}</span><span>👥 {esc(j.get('الفئة'))}</span>{f"<span>⏰ {esc(hours_only(j.get('الشفت')))}</span>" if j.get('الشفت') else ""}</div>
{sal_html}
{tags_html(j)}
<div class="apply-hint">💬 دوس هنا تشوف التفاصيل وتقدّم <span class="chev">‹</span></div>
</a>"""

def bottom_bar(prefix, variant, job=None):
    if variant == "cc":
        return f"""<nav class="bottombar"><a class="btn nav" href="{prefix}index.html">🏠 الرئيسية</a></nav>"""
    if job is not None:
        if APPLY_FLOW_PAGE and variant == "main":
            return f"""<nav class="bottombar"><a class="btn wa" href="{prefix}jobs/{job.get("__jid") or job_id(job)}/apply/">💬 قدّم دلوقتي</a></nav>"""
        return f"""<nav class="bottombar"><a class="btn wa" href="#apply">💬 قدّم دلوقتي</a></nav>"""
    import urllib.parse
    q = urllib.parse.quote("السلام عليكم، عندي استفسار بخصوص الوظايف")
    return f"""<nav class="bottombar"><a class="btn wa" href="https://wa.me/{PHONE}?text={q}" rel="nofollow">💬 اسأل على الواتساب</a></nav>"""

def footer():
    d = TODAY.strftime("%Y-%m-%d")
    return f"""<footer class="foot"><div>🏭 {esc(SITE_NAME)}</div>
<div class="livenote">آخر تحديث للوظايف: {d}</div></footer>"""

def seg_filter():
    return """<div class="wrap"><div class="seg" id="seg">
<button type="button" data-cat="all" class="on">👥 الكل</button>
<button type="button" data-cat="m">👨 شباب</button>
<button type="button" data-cat="g">👩 بنات</button>
</div></div>"""

def area_title_html(c):
    if " - " in c:
        main, sub = c.split(" - ", 1)
        return f'<h3>{esc(main)}</h3><span class="dailysub">💵 {esc(sub)}</span>'
    return f'<h3>{esc(c)}</h3>'

def sharing_tools(js, variant, title, sharepath=None):
    records=[]
    for j in js:
        jid=j.get("__jid") or job_id(j)
        t=ad_text(j,jid)
        if variant=="cc":
            t=t.replace(SITE_BASE+"jobs/",SITE_BASE+"cc/jobs/")
            t=t.replace(PHONE,"").replace("+"+PHONE,"")
        records.append({"name":j.get("المصنع") or "وظيفة", "text":t})
    payload=esc(json.dumps(records,ensure_ascii=False))
    sharepath=sharepath or ("jobs/"+(js[0].get("__jid") or job_id(js[0]))+"/") if len(js)==1 else ("regions/"+city_slug(city_of(js[0]))+"/")
    sharelink=SITE_BASE+("cc/" if variant=="cc" else "")+sharepath
    return f'<details class="share-tools" data-share-tools data-link="{esc(sharelink)}" data-title="{esc(title)}" data-records="{payload}"><summary>↗ مشاركة ونسخ الإعلان</summary><div class="share-grid"><button type="button" data-share="link">نسخ اللينك</button><button type="button" data-share="text">نسخ النص</button><button type="button" data-share="share">مشاركة النص</button><button type="button" data-share="image">حفظ صور الإعلان</button><button type="button" data-share="share-image">مشاركة صورة</button></div><p id="shareStatus" role="status"></p><div id="shareGallery"></div></details>'

def build_variant(jobs_open, variant):
    """يبني نسخة كاملة (رئيسية أو كول سنتر) داخل OUT أو OUT/cc"""
    root = OUT if variant == "main" else os.path.join(OUT, "cc")
    noindex = (variant == "cc")
    os.makedirs(root, exist_ok=True)
    src_css = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "site", "style.css")
    shutil.copy(src_css, os.path.join(root, "style.css"))
    if root != OUT: shutil.copy(os.path.join(OUT, "app.js"), os.path.join(root, "app.js"))
    shutil.copy(os.path.join(os.path.dirname(os.path.abspath(__file__)),"..","site","sharing.js"),os.path.join(root,"sharing.js"))
    for asset in ["pwa.js","sw.js","icon-192.png","icon-512.png"]:
        origin=os.path.join(os.path.dirname(os.path.abspath(__file__)),"..","site",asset) if asset!="sw.js" else os.path.join(OUT,"sw.js")
        dest=os.path.join(root,asset)
        if os.path.abspath(origin)!=os.path.abspath(dest):shutil.copy(origin,dest)
    manifest={"name":SITE_NAME_CC if variant=="cc" else SITE_NAME,"short_name":"Job Gate CC" if variant=="cc" else "Job Gate","start_url":"./","scope":"./","display":"standalone","background_color":"#F2F5F8","theme_color":"#0E5A40","icons":[{"src":"icon-192.png","sizes":"192x192","type":"image/png"},{"src":"icon-512.png","sizes":"512x512","type":"image/png"}]}
    with open(os.path.join(root,"manifest.json"),"w",encoding="utf-8") as mf:json.dump(manifest,mf,ensure_ascii=False)
    order, groups = group_by_city(jobs_open)
    n_open = len(jobs_open)

    # ---------- index ----------
    prefix = ""
    areas_html = ""
    for c in order:
        js = groups[c]
        slug = city_slug(c)
        nums = [best_salary_num(x) for x in js if best_salary_num(x)]
        pay_hint = f"لحد {max(nums):,} ج" if nums else ""
        areas_html += f"""<a class="area-card" href="regions/{slug}/">
<span class="go">‹</span>
<span class="ic">🏭</span>
{area_title_html(c)}
<span class="cnt">{len(js)} وظيفة مفتوحة</span>
{f'<span class="pay">💰 {pay_hint}</span>' if pay_hint else ''}
</a>"""
    body = header("", variant)
    body += steps_strip()
    body += f"""<div class="wrap"><div class="sec"><h2>📍 اختار منطقتك</h2><span class="ln"></span><small>{n_open} وظيفة</small></div></div>
<div class="wrap"><div class="areas">{areas_html}</div></div>"""
    body += footer()
    body += bottom_bar("", variant)
    desc = f"وظايف مصانع تعبئة وتغليف للشباب والبنات في {' و'.join(order)}. مرتبات تبدأ من {min([best_salary_num(x) for x in jobs_open if best_salary_num(x)] or [0]):,} جنيه. قدّم واتساب واستلم الشغل في نفس اليوم."
    html_doc = layout(f"وظايف مصانع تعبئة وتغليف - شباب وبنات | {SITE_NAME}", desc, body, "", variant, SITE_BASE, noindex=noindex, page_cls="pg-home")
    with open(os.path.join(root, "index.html"), "w", encoding="utf-8") as f:
        f.write(html_doc)

    # ---------- region pages ----------
    for c in order:
        js = sort_jobs(groups[c])
        slug = city_slug(c)
        rdir = os.path.join(root, "regions", slug)
        os.makedirs(rdir, exist_ok=True)
        cards = "".join(job_card(j, "../../") for j in js)
        body = header("../../", variant)
        body += f"""<div class="wrap"><a class="bc2" href="../../index.html">→ رجوع للرئيسية</a></div>
<div class="wrap"><div class="sec"><h2>🏭 وظايف {esc(c)}</h2><span class="ln"></span><small>{len(js)} وظيفة</small></div></div>
{seg_filter()}
<div class="wrap"><div class="jobs" id="jobs">{cards}</div></div>
<div class="scrollhint"><span>دي كل وظايف {esc(c)} دلوقتي ✅</span></div>
"""
        body += '<div class="wrap">'+sharing_tools(js,variant,c,"regions/"+slug+"/")+'</div>'
        body += footer()
        body += bottom_bar("../../", variant)
        nums = [best_salary_num(x) for x in js if best_salary_num(x)]
        paybit = f"مرتبات لحد {max(nums):,} جنيه. " if nums else ""
        desc = f"{len(js)} وظيفة مصنع مفتوحة في {c} للشباب والبنات. {paybit}قدّم على الواتساب واستلم الشغل في نفس اليوم."
        doc = layout(f"وظايف مصانع في {c} - {len(js)} وظيفة مفتوحة | {SITE_NAME}", desc, body, "../../", variant, SITE_BASE + f"regions/{slug}/", noindex=noindex, page_cls="pg-region")
        with open(os.path.join(rdir, "index.html"), "w", encoding="utf-8") as f:
            f.write(doc)

    # ---------- job pages ----------
    for j in jobs_open:
        build_job_page(j, root, variant, noindex)
        if APPLY_FLOW_PAGE and variant == "main" and not is_done(j):
            build_apply_page(j, root)

def detail_rows(j):
    ICONS = {"العنوان":"📍","السن":"🎂","طبيعة العمل":"👷","الشفت":"⏰","المؤهل":"🎓","نظام القبض":"💰",
             "السكن":"🏠","السلف":"💵","المواصلات":"🚌","وجبة":"🍽️","التأمينات":"🛡️","الأجازة":"📅","الفئة":"👥"}
    groups = [
        ("📋 الأساسيات", ["الفئة","السن","الشفت","طبيعة العمل","المؤهل","الأجازة"]),
        ("💰 الدفع والمميزات", ["قبض يومي","نظام القبض","الأساسي","حافز الانتظام","السلف","وجبة","التأمينات","تفاصيل المرتب"]),
        ("🏠 السكن والمواصلات", ["السكن","المواصلات","العنوان"]),
    ]
    out = ""
    for gname, keys in groups:
        rows = ""
        for k in keys:
            v = j.get(k) or j.get(k + " ") or (j.get(k.rstrip()) if k.endswith(" ") else None)
            if k == "قبض يومي":
                v = "بتقبض يوميتك بعد ما تخلّص الشغل" if is_daily(j) else None
            if not v: continue
            label = {"قبض يومي":"💵 قبض يومي","الأساسي":"الأساسي","تفاصيل المرتب ":"تفاصيل المرتب"}.get(k, k)
            ic = ICONS.get(k, ICONS.get(k.rstrip(), "▫️"))
            rows += f'<div class="row"><span class="ic">{ic}</span><div><small>{esc(label)}</small><b>{esc(v)}</b></div></div>'
        if rows:
            out += f'<div class="panel"><h2>{gname}</h2><div class="rows">{rows}</div></div>'
    fixed={"المصنع","المنطقة","العنوان","أرقام التواصل","الشفت","السن","طبيعة العمل","المؤهل","الأجازة","نظام القبض","السلف","التأمينات","وجبة","السكن","المواصلات","المرتب","مرتب 30 يوم","مرتب 26 يوم","تفاصيل المرتب","الورديات","تثبيت","الترتيب","آخر تعديل","ظاهر؟","الحالة","تاريخ الإضافة","ملاحظات","الأساسي","حافز الانتظام","قبض يومي","الفئة"}
    extra="".join(f'<div class="row"><div><small>{esc(k)}</small><b>{esc(v)}</b></div></div>' for k,v in j.items() if k not in fixed and not k.startswith("__") and v)
    if extra:out+='<div class="panel"><h2>معلومات إضافية</h2><div class="rows">'+extra+'</div></div>'
    if j.get("ملاحظات"):
        out += f'<div class="panel"><h2>📝 ملاحظات مهمة</h2><div class="notebox">{esc(j["ملاحظات"])}</div></div>'
    return out

def ad_text(j, jid):
    L=[f"📍 المصنع: {j.get('المصنع') or 'غير محدد'}",f"📌 المنطقة: {j.get('المنطقة') or 'غير محددة'}"]
    shifts=parse_shifts(j.get("الورديات") or "")
    if shifts:
        for sh in shifts:
            pp=" | ".join(x for x in [("30 يوم: "+sh["p30"]) if sh["p30"] else "",("26 يوم: "+sh["p26"]) if sh["p26"] else ""] if x)
            L.append("⏰ "+hours_only(sh["h"])+(" (مكتملة)" if sh["done"] else "")+(": "+pp if pp else ""))
    else:
        if j.get("الشفت"): L.append("⏰ الشفت: "+hours_only(j["الشفت"]))
        L.append("💰 المرتب: "+(salary_line(j) or "يراجع داخل التفاصيل"))
    hidden={"المصنع","المنطقة","الشفت","المرتب","مرتب 30 يوم","مرتب 26 يوم","الورديات","أرقام التواصل","ظاهر؟","الحالة","الترتيب","آخر تعديل","تاريخ الإضافة","تثبيت"}
    for k,v in j.items():
        if k in hidden or k.startswith("__") or not v:continue
        L.append(k+": "+str(v))
    L.append("🔗 التفاصيل والتقديم: "+SITE_BASE+f"jobs/{jid}/")
    return "\n".join(L)


def build_apply_page(j, root, prefix_depth="../../"):
    """صفحة تقديم مستقلة للوظيفة (APPLY_FLOW_PAGE): فورم واحد وزرار واحد واضح."""
    jid = j.get("__jid") or job_id(j)
    adir = os.path.join(root, "jobs", jid, "apply")
    os.makedirs(adir, exist_ok=True)
    prefix = "../../../"
    city = city_base(j)
    shifts = parse_shifts(j.get("الورديات") or "")
    multi = bool(shifts)
    wa_direct = wa_apply_link(j)
    age_attrs = (f' data-age-txt="{esc(j.get("السن"))}" data-shift="{esc(hours_only(j.get("الشفت") or ""))}"'
                 f' data-housing="{esc(j.get("السكن"))}" data-transport="{esc(j.get("المواصلات"))}"'
                 f' data-notes="{esc(j.get("ملاحظات"))}"')
    ar3 = age_range(j)
    age_hint2 = f"السن المطلوب في الوظيفة دي: من {ar3[0]} لـ {ar3[1]} سنة" if ar3 else "اكتب سنك بالأرقام"
    body = header(prefix, "main")
    body += f'<div class="wrap"><a class="form-close" href="../" aria-label="قفل التقديم والرجوع للوظيفة">✕</a><a class="bc2" href="../">→ رجوع للوظيفة</a></div>'
    body += f'<div class="wrap"><div class="hero-plain"><h1>💬 قدّم على {esc(j.get("المصنع"))}</h1><div class="sub2">{esc(city)} — املى بياناتك وأكّد مرة واحدة</div></div></div>'
    body += f'<div class="form-transport"><b>المواصلات قبل ما تقدم</b><span>لو جاي من خارج {esc(city)}، الطريق لحد نقطة التجمع على حسابك.</span><span>{esc(j.get("المواصلات") or "راجع مسؤول التواصل عن مواصلات المصنع")}</span></div>'
    if multi:
        opts = ""
        for sh in shifts:
            pay_bits = " | ".join(x for x in [(("30 يوم: " + sh["p30"]) if sh["p30"] else ""), (("26 يوم: " + sh["p26"]) if sh["p26"] else "")] if x)
            opts += f'<button type="button" class="shift-opt{" done" if sh["done"] else ""}" data-h="{esc(hours_only(sh["h"]))}" data-pay="{esc(pay_bits)}"{" disabled" if sh["done"] else ""}>{esc(hours_only(sh["h"]))}{" (مكتملة)" if sh["done"] else ""}<small>{esc(pay_bits)}</small></button>'
        body += f'<div class="wrap"><div class="panel"><h2>🕒 1) اختار الوردية</h2><div class="shift-pick" id="shiftPick">{opts}</div><div class="err" id="e_s"></div></div></div>'
    body += f"""<div class="wrap"><div class="apply-panel" id="apply">
<h2>📝 بياناتك</h2>
<div class="field"><label for="f_n">👤 اسمك ثلاثي<em class="req">*</em></label><div class="err" id="e_n"></div><input id="f_n" autocomplete="name" placeholder="مثال: محمد أحمد علي"><small class="hint">اكتب اسمك ثلاثي زي البطاقة</small></div>
<div class="field"><label for="f_a">🔢 سنك<em class="req">*</em></label><div class="err" id="e_a"></div><input id="f_a" inputmode="numeric" maxlength="2" placeholder="مثال: 25"><small class="hint">{age_hint2}</small></div>
<div class="field"><label for="f_t">📲 رقم الواتساب بتاعك<em class="req">*</em></label><div class="err" id="e_t"></div><input id="f_t" type="tel" inputmode="tel" maxlength="15" placeholder="01XXXXXXXXX"><small class="hint">اكتب رقم فيه واتساب</small></div>

<a class="btn btn-wa" id="applyBtn" href="{esc(wa_direct)}" rel="nofollow"
 data-gender="{esc(j.get("الفئة"))}" data-phone="{PHONE}" data-area="{esc(j.get('المنطقة'))}" data-factory="{esc(j.get('المصنع'))}" data-sal="{esc(salary_line(j))}" data-multi="{1 if multi else 0}"{age_attrs}>
<span class="waic">💬</span> قدّم دلوقتي</a>
<div class="sub" id="handoffNote" role="status">بعد التأكيد دوس إرسال في واتساب عشان طلبك يوصل.</div>
</div></div>"""
    body += footer()
    doc = layout(f"قدّم على وظيفة {j.get('المصنع')} - {city} | {SITE_NAME}",
                 f"التقديم على وظيفة {j.get('المصنع')} في {city} عن طريق الواتساب.",
                 body, prefix, "main", SITE_BASE + f"jobs/{jid}/apply/", noindex=True, page_cls="pg-apply")
    with open(os.path.join(adir, "index.html"), "w", encoding="utf-8") as f:
        f.write(doc)


def build_job_page(j, root, variant, noindex):
    jid = j.get("__jid") or job_id(j)
    jdir = os.path.join(root, "jobs", jid)
    os.makedirs(jdir, exist_ok=True)
    prefix = "../../"
    city = city_base(j)
    shifts = parse_shifts(j.get("الورديات") or "")
    multi = bool(shifts)
    p = pays(j)
    main_sal = (p[0][1] if p else (j.get("المرتب") or "")).replace(" في الشهر", "")
    alt_sal = (p[1][1] if len(p) > 1 else "").replace(" في الشهر", "")

    chips = f'<span class="chip">📍 {esc(j.get("المنطقة"))}</span><span class="chip">👥 {esc(j.get("الفئة"))}</span>'
    if j.get("الشفت") and not multi:
        chips += f'<span class="chip">⏰ {esc(hours_only(j.get("الشفت")))}</span>'
    body = f"""<header class="hero-card"><div class="wrap">
<a class="bc" href="{prefix}index.html">→ رجوع للرئيسية</a>
<h1>{esc(j.get('المصنع'))}</h1>
<div class="chips">{chips}</div>
{tags_html(j)}
</div></header>"""
    if main_sal:
        body += f"""<div class="sal-hero"><small>{"اليومية" if is_daily(j) else "المرتب"}</small>
<div class="big">{esc(main_sal)}</div>
{f'<div class="alt">أو {esc(alt_sal)} — نظام 26 يوم + 4 أيام إجازة</div>' if alt_sal else ''}
</div>"""
    if multi:
        opts = ""
        for i, s in enumerate(shifts):
            pay_bits = " | ".join(x for x in [(("30 يوم: " + s["p30"]) if s["p30"] else ""), (("26 يوم: " + s["p26"]) if s["p26"] else "")] if x)
            opts += f'<button type="button" class="shift-opt{" done" if s["done"] else ""}" data-h="{esc(hours_only(s["h"]))}" data-pay="{esc(pay_bits)}"{" disabled" if s["done"] else ""}>{esc(hours_only(s["h"]))}{" (مكتملة)" if s["done"] else ""}<small>{esc(pay_bits)}</small></button>'
        body += f'<div class="panel"><h2>🕒 اختار الوردية اللي تناسبك</h2><div class="shift-pick" id="shiftPick">{opts}</div><div class="err" id="e_s"></div></div>'
    body += f'<div id="jobMeta" hidden data-factory="{esc(j.get("المصنع"))}" data-area="{esc(j.get("المنطقة"))}"></div>'
    body += detail_rows(j)
    body += '<div class="panel"><h2>🚌 مهم قبل التقديم</h2><div class="warnbox">▸ لو مكانك خارج ' + esc(city) + '، المواصلات لحد نقطة التجمع جوه ' + esc(city) + ' على حسابك الشخصي، ومن نقطة التجمع عربيات المصنع بتاخدك.</div></div>'

    cts = parse_contacts(j)
    if cts and variant == "main":
        cbtn = "".join(f'<a class="btn btn-call" href="tel:{esc(c["phone"])}">📞 {esc(c["name"] or "مسؤول التواصل")}<small>{esc(c["phone"])}</small></a>' for c in cts)
        body += f'<div class="wrap"><div class="panel"><h2>📞 كلم مسؤول التواصل</h2>{cbtn}</div></div>'

    if variant == "cc":
        body += """<div class="wrap"><div class="cc-note"><span class="ic">🙋‍♂️</span>
للتقديم على الوظيفة دي، ارجع للمسؤول اللي بعتلك اللينك ده وهو هيكمّلك إجراءات التقديم فورًا.</div></div>"""
    else:
        wa_direct = wa_apply_link(j)
        age_attrs = (f' data-age-txt="{esc(j.get("السن"))}" data-shift="{esc(hours_only(j.get("الشفت") or ""))}"'
                     f' data-housing="{esc(j.get("السكن"))}" data-transport="{esc(j.get("المواصلات"))}"'
                     f' data-notes="{esc(j.get("ملاحظات"))}"')
        ar2 = age_range(j)
        age_hint = f"السن المطلوب في الوظيفة دي: من {ar2[0]} لـ {ar2[1]} سنة" if ar2 else "اكتب سنك بالأرقام"
        ap_cls = "apply-panel" if SHOW_APPLY_FORM else "apply-panel hidden"
        form_panel = f"""<div class="{ap_cls}" id="apply">
<h2>💬 قدّم على الوظيفة دي</h2>
<div class="sub">⏰ التقديم واستلام الشغل في نفس اليوم</div>
<div class="field"><label for="f_n">👤 اسمك ثلاثي<em class="req">*</em></label><input id="f_n" autocomplete="name" placeholder="مثال: محمد أحمد علي"><small class="hint">اكتب اسمك ثلاثي زي البطاقة</small></div>
<div class="err" id="e_n"></div>
<div class="field"><label for="f_a">🔢 سنك<em class="req">*</em></label><input id="f_a" inputmode="numeric" maxlength="2" placeholder="مثال: 25"><small class="hint">{age_hint}</small></div>
<div class="err" id="e_a"></div>
<div class="field"><label for="f_t">📲 رقم الواتساب بتاعك<em class="req">*</em></label><input id="f_t" type="tel" inputmode="tel" maxlength="15" placeholder="01XXXXXXXXX"><small class="hint">اكتب رقم فيه واتساب</small></div>
<div class="err" id="e_t"></div>
<a class="btn btn-wa" id="applyBtn" href="{esc(wa_direct)}" rel="nofollow"
 data-phone="{PHONE}" data-area="{esc(j.get('المنطقة'))}" data-factory="{esc(j.get('المصنع'))}" data-sal="{esc(salary_line(j))}" data-multi="{1 if multi else 0}"{age_attrs}>
<span class="waic">💬</span> دوس هنا وكمّل على الواتساب</a>
<div class="sub" style="margin-top:10px">هيفتح الواتساب برسالة جاهزة فيها بياناتك والوظيفة — بس دوس ابعت ✅</div>
</div>"""
        copy_btn = ''
        if APPLY_FLOW_PAGE and variant == "main":
            body += ""
        elif SHOW_APPLY_FORM:
            body += '<div class="wrap">' + form_panel + copy_btn + '</div>'
        else:
            body += '<div class="wrap"><a class="btn btn-wa" href="#apply" data-reveal="#apply"><span class="waic">💬</span> قدّم دلوقتي</a>' + form_panel + copy_btn + '</div>'

    body += '<div class="wrap">'+sharing_tools([j],variant,j.get("المصنع"))+'</div>'
    body += footer()
    body += bottom_bar(prefix, variant, job=j)

    n = best_salary_num(j)
    ld = {"@context": "https://schema.org", "@type": "JobPosting",
          "title": f"{j.get('المصنع')} - {city}",
          "description": re.sub(r"\s+", " ", f"وظيفة {j.get('طبيعة العمل') or 'عمال إنتاج'} في {j.get('المصنع')} بمنطقة {city}. المرتب: {salary_line(j)}. السن المطلوب: {j.get('السن','')}. التقديم عن طريق الواتساب.").strip(),
          "hiringOrganization": {"@type": "Organization", "name": j.get("المصنع"), "sameAs": SITE_BASE},
          "jobLocation": {"@type": "Place", "address": {"@type": "PostalAddress", "addressLocality": city, "addressCountry": "EG"}},
          "employmentType": "FULL_TIME", "directApply": True,
          "datePosted": (j.get("تاريخ الإضافة") or "")}
    posted = str(j.get("تاريخ الإضافة") or "").translate(str.maketrans("٠١٢٣٤٥٦٧٨٩","0123456789"))
    pm=re.search(r"(\d{1,4})[/\-.](\d{1,2})[/\-.](\d{1,4})",posted)
    ld.pop("datePosted",None)
    if pm:
        try:
            a,b,c=map(int,pm.groups());y,mo,d=(a,b,c) if len(pm[1])==4 else (c,b,a)
            if y<100:y+=2000
            ld["datePosted"]=datetime.date(y,mo,d).isoformat()
        except ValueError:pass
    if n:
        ld["baseSalary"] = {"@type": "MonetaryAmount", "currency": "EGP",
                            "value": {"@type": "QuantitativeValue", "value": n, "unitText": "DAY" if is_daily(j) else "MONTH"}}
    sal = salary_line(j).replace(" في الشهر", "")
    desc = f"وظيفة {j.get('المصنع')} في {city} - {j.get('الفئة')}. {('المرتب ' + sal + '. ') if sal else ''}التقديم واتساب واستلام الشغل في نفس اليوم."
    doc = layout(f"{j.get('المصنع')} - وظيفة في {city} | {SITE_NAME}", desc, body, prefix, variant,
                 SITE_BASE + f"jobs/{jid}/", json_ld=ld, noindex=noindex, page_cls="pg-job")
    with open(os.path.join(jdir, "index.html"), "w", encoding="utf-8") as f:
        f.write(doc)

def write_static_files():
    src_css = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "site", "style.css")
    shutil.copy(src_css, os.path.join(OUT, "style.css"))
    app_js = r"""
/* بوابة الوظائف — تفاعلات بسيطة (مفيش جلب بيانات، كل المحتوى موجود في الصفحة) */
(function(){
"use strict";
var STATS_URL="__STATS_URL__";
var SRC=(function(){var v="";try{v=(new URLSearchParams(location.search).get("src")||"").replace(/[\r\n]/g," ").trim().slice(0,30)}catch(e){}
 try{if(v)sessionStorage.setItem("jobsrc",v);else v=sessionStorage.getItem("jobsrc")||""}catch(e){}return v})();
var VID="";try{VID=localStorage.getItem("vid");if(!VID){VID=Date.now().toString(36)+Math.random().toString(36).slice(2,8);localStorage.setItem("vid",VID)}}catch(e){}
var __tv={};
function track(t,f,r){try{
 if(t==="visit"){if(sessionStorage.getItem("tv"))return;sessionStorage.setItem("tv","1")}
 if(t==="view"&&f){if(__tv[f])return;__tv[f]=1}
 var q=new URLSearchParams({a:"log",t:t,f:f||"",r:r||"",s:SRC,p:(location.pathname.split("/").pop()||"index.html"),v:VID});
 fetch(STATS_URL+"?"+q,{mode:"no-cors",keepalive:true}).catch(function(){})
}catch(e){}}
track("visit");
var jm=document.getElementById("jobMeta");if(jm)track("view",jm.getAttribute("data-factory"),jm.getAttribute("data-area"));
/* فلتر شباب / بنات */
var seg=document.getElementById("seg");
if(seg){
 seg.querySelectorAll("button").forEach(function(b){
  b.addEventListener("click",function(){
   seg.querySelectorAll("button").forEach(function(x){x.classList.remove("on")});
   b.classList.add("on");
   var cat=b.getAttribute("data-cat");
   document.querySelectorAll("#jobs .job").forEach(function(card){
    var c=card.getAttribute("data-cat");
    card.style.display=(cat==="all"||c===cat||c==="b")?"":"none";
   });
  });
 });
}

function normalizedName(n){return String(n||"").trim().split(/\s+/)[0].replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/[\u064B-\u065F\u0670ـ]/g,"")}
function nameMismatch(n,req,label){var first=normalizedName(n),female="ليلي فاطمة فاطمه عائشة عايشة خديجة خديجه مريم زينب رقية رقيه اميرة اميره هبة هبه نجلاء شيماء اسماء دعاء اسراء منة منه ايمان سارة ساره سمية سميه بسمة بسمه ياسمين نادية ناديه شيرين حنان عبير ولاء صفاء امل دينا هاجر رحاب رانيا شروق",male="احمد محمد محمود مصطفي ابراهيم اسماعيل اسحق يوسف يونس يحيي موسي عيسي ادم عمر عمرو عثمان خالد وليد سعيد سامح سمير شريف اشرف ايمن طارق حسن حسين حسام كريم هيثم معتز مجدي حمدي عادل صبري منصور فؤاد نبيل صلاح رمضان رجب شعبان";var g=/بنات|إناث|اناث/.test(req||""),b=/شباب|ذكور|رجال/.test(req||"");if(b&&!g&&female.split(" ").indexOf(first)>=0)return label+" للشباب بس";if(g&&!b&&male.split(" ").indexOf(first)>=0)return label+" للبنات بس";return ""}
function reviewScreen(form,rows,transport,url){
 var old=document.getElementById("confirmScreen");if(old)old.remove();
 var screen=document.createElement("section");screen.id="confirmScreen";screen.className="confirm-screen wrap";screen.setAttribute("aria-label","تأكيد بياناتك");document.body.classList.add("confirming");
 var card=document.createElement("div");card.className="panel";var title=document.createElement("h2");title.textContent="بياناتك دي صح؟";card.appendChild(title);
 rows.forEach(function(v){var row=document.createElement("div");row.className="cfrow";var k=document.createElement("span"),b=document.createElement("b");k.textContent=v[0];b.textContent=v[1]||"مش محدد";row.append(k,b);card.appendChild(row)});
 var warning=document.createElement("div");warning.className="confirm-transport";warning.setAttribute("role","note");var wh=document.createElement("strong");wh.textContent="⚠️ مهم: المواصلات";var detail=document.createElement("p");detail.textContent=transport;warning.append(wh,detail);card.appendChild(warning);
 var back=document.createElement("button");back.type="button";back.className="btn btn-ghost";back.textContent="ارجع عدّل";
 var next=document.createElement("a");next.href=url;next.target="_blank";next.rel="noopener";next.className="btn btn-wa";next.textContent="كمل على واتساب";
 var hint=document.createElement("p");hint.className="hint";hint.textContent="واتساب هيفتح برسالتك جاهزة. دوس إرسال هناك عشان طلبك يوصل.";
 var close=document.createElement("button");close.type="button";close.className="form-close";close.setAttribute("aria-label","قفل التأكيد والرجوع للتعديل");close.textContent="✕";card.prepend(close);card.append(back,next,hint);screen.appendChild(card);form.closest(".wrap").after(screen);
 var hidden=[];Array.from(document.querySelectorAll(".jg>.wrap,body>.wrap,.form-transport")).forEach(function(e){if(e!==screen){hidden.push([e,e.style.display]);e.style.display="none"}});
 if(!hidden.some(function(x){return x[0]===form.closest(".wrap")})){hidden.push([form.closest(".wrap"),form.closest(".wrap").style.display]);form.closest(".wrap").style.display="none"}
 function restore(){document.body.classList.remove("confirming");hidden.forEach(function(x){x[0].style.display=x[1]});screen.remove();window.removeEventListener("popstate",onBack);form.scrollIntoView({block:"start"})}function onBack(){restore()}history.pushState(Object.assign({},history.state,{jgConfirm:true}),"",location.href);window.addEventListener("popstate",onBack);back.onclick=close.onclick=function(){if(history.state&&history.state.jgConfirm)history.back();else restore()};screen.scrollIntoView({block:"start"});
}
window.jgNameMismatch=nameMismatch;window.jgReviewScreen=reviewScreen;
/* اختيار وردية */
var pickedShift=null;
var sp=document.getElementById("shiftPick");
if(sp){
 sp.querySelectorAll(".shift-opt").forEach(function(b){
  b.addEventListener("click",function(){
   sp.querySelectorAll(".shift-opt").forEach(function(x){x.classList.remove("on")});
   b.classList.add("on");
   var es=document.getElementById("e_s");if(es)es.textContent="";
   sp.classList.remove("bad");
   pickedShift={h:b.getAttribute("data-h"),pay:b.getAttribute("data-pay")};
  });
 });
}

/* فورم التقديم: نفس شروط ورسايل الموقع القديم بالظبط */
var btn=document.getElementById("applyBtn");
if(btn){
 track("apply",btn.getAttribute("data-factory"),btn.getAttribute("data-area"));
 var dg=function(s){return String(s||"").replace(/[٠-٩]/g,function(x){return "٠١٢٣٤٥٦٧٨٩".indexOf(x)})};
 var setErr=function(id,m){var e=document.getElementById(id);if(e)e.textContent=m||""};
 var en=document.getElementById("f_n"),ea=document.getElementById("f_a"),et=document.getElementById("f_t");
 try{var sv=JSON.parse(localStorage.getItem("jobform")||"{}");if(sv.n&&en)en.value=sv.n;if(sv.a&&ea)ea.value=sv.a;if(sv.t&&et)et.value=sv.t}catch(e){}

 var EG=/^(?:\+?20|0)1[0125]\d{8}$/;
 var fail=function(inp,id,m){setErr(id,m);if(inp){inp.classList.add("bad");inp.setAttribute("aria-invalid","true");inp.focus();inp.scrollIntoView({block:"center",behavior:"smooth"})}};
 function ageRange(txt){
  var t=String(txt||"").replace(/[٠-٩]/g,function(d){return "٠١٢٣٤٥٦٧٨٩".indexOf(d)});
  var n=(t.match(/\d{1,2}/g)||[]).map(Number);
  if(!n.length)return null;
  if(n.length>=2)return{min:Math.min(n[0],n[1]),max:Math.max(n[0],n[1])};
  if(/لحد|حتى|لغاية|إلى|الى|أقل|اقل/.test(t))return{min:0,max:n[0]};
  if(/فوق|أكتر|اكتر|أكثر|\+|من/.test(t))return{min:n[0],max:0};
  return null}
 function ageMsg(a){
  var r=ageRange(btn.getAttribute("data-age-txt"));if(!r||!a)return "";
  var rt=r.min&&r.max?"من "+r.min+" لـ "+r.max+" سنة":r.min?r.min+" سنة فأكتر":"لحد "+r.max+" سنة";
  if(r.min&&a<r.min)return "سنك غير مسموح، السن المطلوب "+rt;
  if(r.max&&a>r.max)return "سنك أكبر من المسموح، السن المطلوب "+rt;
  return ""}

 function nameError(){var n=en.value.trim().replace(/\s+/g," ");if(n.split(" ").filter(function(w){return w.length>=2}).length<3)return "لازم تكتب اسمك ثلاثي";return nameMismatch(n,btn.getAttribute("data-gender"),"المصنع ده")}
 function showField(i,id,m){setErr(id,m);i.classList.toggle("bad",!!m);i.setAttribute("aria-invalid",m?"true":"false")}
 en.addEventListener("input",function(){showField(en,"e_n",nameError())});en.addEventListener("blur",function(){showField(en,"e_n",nameError())});
 et.addEventListener("input",function(){var t=dg(et.value).replace(/[\s-]/g,"");showField(et,"e_t",EG.test(t)?"":"الرقم ناقص، اكتب رقم واتساب مصري صحيح")});
 ea.addEventListener("input",function(){var a=dg(ea.value);showField(ea,"e_a",/^\d{1,2}$/.test(a)?ageMsg(+a):"اكتب السن بالأرقام")});
 btn.addEventListener("click",function(ev){
  ev.preventDefault();var n=en.value.trim().replace(/\s+/g," "),a=dg(ea.value),t=dg(et.value).replace(/[\s-]/g,"");
  if(nameError())return fail(en,"e_n",nameError());
  if(!/^\d{1,2}$/.test(a)||+a<16||+a>60)return fail(ea,"e_a","اكتب السن الصحيح بالأرقام");
  if(ageMsg(+a))return fail(ea,"e_a",ageMsg(+a));
  if(!EG.test(t))return fail(et,"e_t","الرقم ناقص، اكتب رقم واتساب مصري صحيح");
  if(btn.getAttribute("data-multi")==="1"&&!pickedShift){setErr("e_s","لازم تختار الوردية");sp.classList.add("bad");sp.scrollIntoView({block:"center",behavior:"smooth"});return}
  var shift=pickedShift?pickedShift.h:btn.getAttribute("data-shift"),pay=pickedShift?pickedShift.pay:btn.getAttribute("data-sal");
  var L=["الاسم: "+n,"السن: "+a,"رقم الواتساب: "+t,"المكان: "+btn.getAttribute("data-area"),"المصنع: "+btn.getAttribute("data-factory"),"الوردية: "+shift,"المرتب: "+pay];if(SRC)L.push("المصدر: "+SRC);
  var u="https://wa.me/"+btn.getAttribute("data-phone")+"?text="+encodeURIComponent(L.join("\n"));
  var transport=btn.getAttribute("data-transport")||"معلومات المواصلات مش محددة، اسأل مسؤول التواصل قبل التحرك";
  if(/لا يوجد|لايوجد|غير متوفر|بدون|مفيش|لا تتوفر/.test(transport))transport="الشغل ده مفيهوش مواصلات. "+transport;
  else if(/داخلي|السكن/.test(transport))transport="مفيش مواصلات من بلدك للمصنع. المواصلات الداخلية بس: "+transport;
  reviewScreen(document.getElementById("apply"),[["الاسم",n],["السن",a],["رقم الواتساب",t],["المصنع",btn.getAttribute("data-factory")],["الوردية",shift],["المرتب",pay]],transport+". لو جاي من خارج "+btn.getAttribute("data-area")+"، الطريق لنقطة التجمع على حسابك.",u);
 });
}

/* نسخ إعلان الوظيفة */
var cad=document.getElementById("copyAd");
if(cad){cad.addEventListener("click",function(){
 var txt=cad.getAttribute("data-txt")||"";
 var done=function(){cad.textContent="✅ اتنسخ، ابعته في أي مكان";setTimeout(function(){cad.textContent="📋 انسخ إعلان الوظيفة"},2500)};
 if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(done,done)}
 else{var ta=document.createElement("textarea");ta.value=txt;document.body.appendChild(ta);ta.select();try{document.execCommand("copy")}catch(e){}ta.remove();done()}
});}
})();
"""
    app_js += """
// القايمة الجانبية
(function(){
 var mb=document.getElementById("menuBtn"),dr=document.getElementById("drawer"),
     sc=document.getElementById("scrim"),dc=document.getElementById("drawerClose");
 function setD(o){if(!dr)return;dr.classList.toggle("open",o);sc.classList.toggle("open",o);document.body.classList.toggle("menu-open",o);mb.setAttribute("aria-expanded",o?"true":"false");dr.setAttribute("aria-hidden",o?"false":"true");if(o)dc.focus();else mb.focus()}
 function openD(){if(dr.classList.contains("open"))return;history.pushState(Object.assign({},history.state,{jgMenu:true}),"",location.href);setD(true)}
 function closeD(){if(!dr.classList.contains("open"))return;if(history.state&&history.state.jgMenu)history.back();else setD(false)}
 if(mb){mb.setAttribute("aria-expanded","false");mb.addEventListener("click",openD)}
 if(dc)dc.addEventListener("click",closeD);
 if(sc)sc.addEventListener("click",closeD);
 window.addEventListener("popstate",function(){if(dr&&dr.classList.contains("open"))setD(false)});
 document.addEventListener("keydown",function(e){if(e.key==="Escape")closeD()});
})();
"""
    app_js += """
// فتح فورم التقديم لو مخفية ورا زرار (أو من الزرار اللي تحت)
document.addEventListener("click",function(e){
 var b=e.target.closest("[data-reveal],a[href='#apply']"); if(!b)return;
 var sel=b.getAttribute("data-reveal")||b.getAttribute("href");
 var p=document.querySelector(sel); if(!p)return;
 e.preventDefault();
 p.classList.remove("hidden");
 p.scrollIntoView({behavior:"smooth",block:"start"});
 if(b.hasAttribute("data-reveal"))b.style.display="none";
});
"""
    app_js = app_js.replace("__STATS_URL__", STATS_URL)
    with open(os.path.join(OUT, "app.js"), "w", encoding="utf-8") as f:
        f.write(app_js)
    # Network-first caching replaces the old worker and labels offline copies.
    sw = r"""const CACHE='jobgate-v2-'+new URL(self.registration.scope).pathname;
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k!==CACHE&& !k.startsWith('jobgate-v2-'))await caches.delete(k);await self.clients.claim()})()));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;
e.respondWith((async()=>{const c=await caches.open(CACHE);try{const r=await fetch(e.request);if(r.ok){await c.put(e.request,r.clone())}return r}catch(_){const saved=await c.match(e.request);if(saved)return saved;return new Response('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>الاتصال بالإنترنت</title><body style="font:20px Tahoma;padding:32px;background:#F2F5F8;color:#0E5A40"><h1>أنت مش متصل بالنت</h1><p>الصفحة دي مش محفوظة. اتصل بالنت وحدّث الصفحة.</p></body></html>',{headers:{'Content-Type':'text/html;charset=utf-8'}})}})())});"""
    with open(os.path.join(OUT, "sw.js"), "w", encoding="utf-8") as f:f.write(sw)



def write_cc_jobs_page():
    """صفحة توظيف فريق الكول سنتر (بنات) — نفس رسالة الواتساب بتاعة الصفحة القديمة"""
    cdir = os.path.join(OUT, "cc-jobs")
    os.makedirs(cdir, exist_ok=True)
    body = header("../", "main")
    body += r"""<div class="wrap"><a class="bc2" href="../index.html">→ رجوع للرئيسية</a></div>
<div class="wrap"><div class="hero-plain"><h1>📢 اشتغلي أونلاين بعمولة</h1>
<div class="sub2">وظيفة مسوّقة بالعمولة في فريق التوظيف أونلاين — شغل من الموبايل</div></div></div>
<div class="wrap"><section class="panel recruitment-details"><h2>تفاصيل شغل فريق التوظيف</h2><img src="../recruitment-ad.webp" width="800" height="885" alt="مطلوب فريق توظيف أونلاين بالعمولة، نشر الإعلانات والتواصل مع العمال وتقديم الوظيفة المناسبة" style="display:block;width:100%;height:auto;border-radius:14px" loading="lazy"></section></div>
<div class="wrap"><div class="apply-panel" id="ccApply"><a class="form-close" href="../" aria-label="قفل التقديم والرجوع للرئيسية">✕</a>
<h2>📲 قدّمي على واتساب</h2>
<div class="field"><label for="c_n">👤 الاسم<em class="req">*</em></label><input id="c_n" autocomplete="name" placeholder="اكتبي اسمك"><small class="hint">اكتبي اسمك الحقيقي</small></div>
<div class="field"><label for="c_a">🔢 السن<em class="req">*</em></label><input id="c_a" inputmode="numeric" maxlength="2" placeholder="مثال: 22"><small class="hint">اكتبي سنك بالأرقام</small></div>
<div class="field"><label for="c_t">📞 رقم الواتساب اللي هتشتغلي بيه<em class="req">*</em></label><input id="c_t" type="tel" inputmode="tel" maxlength="15" placeholder="01XXXXXXXXX"><small class="hint">اكتبي رقم فيه واتساب</small></div>
<div class="field"><label for="c_x">💼 اشتغلتي الشغل ده قبل كده؟<em class="req">*</em></label>
<select id="c_x"><option value="">— اختار —</option><option value="آه">آه</option><option value="لا">لا</option></select></div>
<div class="field" id="c_cw" hidden><label for="c_c">🏢 اسم الشركة اللي كنتي شغالة فيها</label><input id="c_c" placeholder="اسم الشركة"></div>

<div class="err" id="c_e"></div>
<button class="btn btn-wa" type="button" id="ccSend"><span class="waic">💬</span> قدّمي دلوقتي</button>
</div></div>
<script>
(function(){
var $=function(i){return document.getElementById(i)};
if(!$('ccSend'))return;
var dg=function(s){return String(s||'').replace(/[٠-٩]/g,function(ch){return '٠١٢٣٤٥٦٧٨٩'.indexOf(ch)})};

function fieldError(id,msg){var f=$(id),e=$(id+'_error');if(!e){e=document.createElement('div');e.id=id+'_error';e.className='err';f.before(e)}e.textContent=msg;f.classList.toggle('bad',!!msg);f.setAttribute('aria-invalid',msg?'true':'false')}
function fail(id,msg){fieldError(id,msg);$(id).focus();$(id).scrollIntoView({block:'center',behavior:'smooth'})}
function ccNameError(){var n=$('c_n').value.trim();return n.split(/\s+/).filter(function(w){return w.length>=2}).length<3?'لازم تكتب اسمك ثلاثي':window.jgNameMismatch(n,'بنات','الشغل ده')}
$('c_n').addEventListener('input',function(){fieldError('c_n',ccNameError())});
$('c_t').addEventListener('input',function(){fieldError('c_t',/^(?:\+?20|0)1[0125]\d{8}$/.test(dg(this.value).replace(/[\s-]/g,''))?'':'الرقم ناقص، اكتبي رقم واتساب مصري صحيح')});
$('c_x').onchange=function(){$('c_cw').hidden=this.value!=='آه';fieldError('c_x','')};
$('ccSend').onclick=function(){
 var n=$('c_n').value.trim().replace(/\s+/g,' '),a=dg($('c_a').value.trim()),p=dg($('c_t').value.replace(/[\s-]/g,'')),x=$('c_x').value,c=$('c_c').value.trim();
 if(ccNameError())return fail('c_n',ccNameError());
 if(!/^\d{1,2}$/.test(a)||+a<1)return fail('c_a','اكتبي السن بالأرقام');
 if(!/^(?:\+?20|0)1[0125]\d{8}$/.test(p))return fail('c_t','الرقم ناقص، اكتبي رقم واتساب مصري صحيح');
 if(!x)return fail('c_x','اختاري آه أو لا');if(x==='آه'&&!c)return fail('c_c','اكتبي اسم الشركة');
 ['c_n','c_a','c_t','c_x','c_c'].forEach(function(id){fieldError(id,'')});
 var L=['السلام عليكم، محتاج التفاصيل عن وظيفة مسوق بالعمولة (فريق التوظيف أونلاين)','الاسم: '+n,'السن: '+a,'رقم الواتساب: '+p,'اشتغلت الشغل ده قبل كده: '+x];if(x==='آه')L.push('الشركة: '+c);
 window.jgReviewScreen($('ccApply'),[['الاسم',n],['السن',a],['رقم الواتساب',p],['الوظيفة','مسوّقة في فريق التوظيف'],['نظام الشغل','أونلاين من الموبايل'],['المقابل','بالعمولة'],['اشتغلتي قبل كده؟',x]],'الشغل ده أونلاين من الموبايل، مفيش انتقال لمصنع ولا مواصلات.', 'https://wa.me/__PHONE__?text='+encodeURIComponent(L.join('\n')));
};

})();
</script>"""
    body = body.replace("__PHONE__", PHONE)
    body += footer()
    desc = "وظايف كول سنتر للبنات: اشتغلي مسوّقة بالعمولة أونلاين في فريق التوظيف. قدّمي على الواتساب في دقيقة."
    doc = layout("اشتغلي أونلاين بعمولة - وظايف كول سنتر للبنات | " + SITE_NAME, desc, body, "../", "main",
                 SITE_BASE + "cc-jobs/", page_cls="pg-job")
    with open(os.path.join(cdir, "index.html"), "w", encoding="utf-8") as f:
        f.write(doc)

def write_seo_files(city_order, jobs_open):
    urls = [SITE_BASE, SITE_BASE + "cc-jobs/"]
    for c in city_order:
        urls.append(SITE_BASE + "regions/" + city_slug(c) + "/")
    for j in jobs_open:
        urls.append(SITE_BASE + "jobs/" + (j.get("__jid") or job_id(j)) + "/")
    sm = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    d = TODAY.strftime("%Y-%m-%d")
    for i, u in enumerate(urls):
        pri = "1.0" if i == 0 else ("0.8" if "/regions/" in u else "0.6")
        sm.append(f"<url><loc>{u}</loc><lastmod>{d}</lastmod><changefreq>daily</changefreq><priority>{pri}</priority></url>")
    sm.append("</urlset>")
    with open(os.path.join(OUT, "sitemap.xml"), "w", encoding="utf-8") as f:
        f.write("\n".join(sm))
    with open(os.path.join(OUT, "robots.txt"), "w", encoding="utf-8") as f:
        f.write("User-agent: *\nAllow: /\nDisallow: /cc/\nDisallow: /admin.html\nDisallow: /stats.html\nDisallow: /marketing.html\nDisallow: /callcenter.html\n\nSitemap: " + SITE_BASE + "sitemap.xml\n")

def assign_ids(jobs):
    seen = {}
    for j in jobs:
        base = job_id(j)
        n = seen.get(base, 0) + 1
        seen[base] = n
        j["__jid"] = base if n == 1 else f"{base}-{n}"

def main():
    local_jobs = os.environ.get("JOBS_CSV")
    if local_jobs:
        with open(local_jobs, encoding="utf-8") as f:
            csv_text = f.read()
    else:
        csv_text = fetch_csv("الوظائف")
    jobs = load_jobs(csv_text)
    open_jobs = [j for j in visible_jobs(jobs) if not is_done(j)]
    assign_ids(open_jobs)
    print("rows:", len(jobs), "visible:", len(visible_jobs(jobs)), "open:", len(open_jobs))
    os.makedirs(OUT, exist_ok=True)
    write_static_files()
    shutil.copy(os.path.join(os.path.dirname(os.path.abspath(__file__)),"..","site","recruitment-ad.webp"),os.path.join(OUT,"recruitment-ad.webp"))
    write_cc_jobs_page()
    for old, target in [("callcenter.html","cc/"),("marketing.html","cc-jobs/")]:
        with open(os.path.join(OUT,old),"w",encoding="utf-8") as f:
            f.write(f'<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><script>location.replace("{target}"+location.search+location.hash)</script><title>بوابة الوظايف</title><a href="{target}">افتح الصفحة</a></html>')
    build_variant(open_jobs, "main")
    build_variant(open_jobs, "cc")
    route_data=[{"name":j.get("المصنع"),"id":j["__jid"],"area":j.get("المنطقة"),"region":city_slug(city_of(j)),"legacyIndex":i} for i,j in enumerate(visible_jobs(jobs)) if j in open_jobs]
    route_script="""(function(){var rows=__DATA__,q=new URLSearchParams(location.search),base=document.body.getAttribute('data-prefix')||'',cc=location.pathname.indexOf('/cc/')>=0,raw=location.hash,match=null;function hid(n){var h=5381;for(var c of String(n))h=((h<<5)+h+c.charCodeAt(0))>>>0;return h.toString(36)}if(q.get('j'))match=rows.find(function(j){return hid(j.name)===q.get('j')});if(raw.indexOf('#f=')===0){try{var name=decodeURIComponent(raw.slice(3));match=rows.find(function(j){return j.name===name})}catch(e){}}var m=raw.match(/^#job(\d+)$/);if(m&&!match)match=rows.find(function(j){return j.legacyIndex===+m[1]});if(!match&&q.get('area')){var ar=rows.find(function(j){return j.area===q.get('area')});if(ar){location.replace(base+'regions/'+ar.region+'/');return}}if(match){var src=q.get('src');location.replace(base+'jobs/'+match.id+'/'+(src?'?src='+encodeURIComponent(src):''))}})();""".replace('__DATA__',json.dumps(route_data,ensure_ascii=False))
    for rt in [OUT,os.path.join(OUT,"cc")]:
        with open(os.path.join(rt,"legacy.js"),"w",encoding="utf-8") as f:f.write(route_script)
    order, _ = group_by_city(open_jobs)
    write_seo_files(order, open_jobs)
    n_pages = sum(len(files) for _, _, files in os.walk(OUT))
    print("files written:", n_pages)

if __name__ == "__main__":
    main()
