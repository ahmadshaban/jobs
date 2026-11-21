# -*- coding: utf-8 -*-
"""Shared data layer: fetch + parse the jobs Google Sheet (gviz CSV)."""
import csv, io, json, re, sys, urllib.request

SHEET_ID = "1UXAwDfIn3oxU68byv1I6dIrdQaKm2OXhhj7NoHlwRBU"  # الشيت الأساسي (مصدر الحقيقة)
PHONE = "201095237207"
SITE_BASE = "https://ahmadshaban.github.io/jobs/"
SITE_NAME = "بوابة الوظائف"
SITE_NAME_CC = "Job Gate CC"

def fetch_csv(sheet_name):
    url = ("https://docs.google.com/spreadsheets/d/" + SHEET_ID +
           "/gviz/tq?tqx=out:csv&headers=1&sheet=" + urllib.parse.quote(sheet_name))
    req = urllib.request.Request(url, headers={"User-Agent": "jobgate-builder/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8")

def load_jobs(csv_text):
    rows = list(csv.reader(io.StringIO(csv_text)))
    if not rows:
        return []
    headers = [h.strip() for h in rows[0]]
    jobs = []
    for raw in rows[1:]:
        if not any(c.strip() for c in raw):
            continue
        j = {headers[i]: (raw[i] if i < len(raw) else "").strip() for i in range(len(headers))}
        jobs.append(j)
    return jobs

AR_DIGITS = "٠١٢٣٤٥٦٧٨٩"
def num_of(s):
    t = str(s or "")
    t = "".join(str(AR_DIGITS.index(d)) if d in AR_DIGITS else d for d in t)
    t = t.replace(",", "")
    m = re.search(r"\d+(\.\d+)?", t)
    return float(m.group(0)) if m else 0

def is_done(j):
    return "مكتمل" in (j.get("الحالة") or "")

def is_urgent(j):
    return bool(re.search(r"عاجل|الأكثر تقديم", j.get("الحالة") or ""))

NEW_DAYS = 3
def is_new(j, today):
    t = j.get("تاريخ الإضافة") or ""
    m = re.search(r"(\d{1,4})[/\-.](\d{1,2})[/\-.](\d{1,4})", t)
    if not m:
        return False
    a, b, c = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if len(m.group(1)) == 4:
        y, mo, d = a, b, c
    else:
        d, mo, y = a, b, c
        if y < 100: y += 2000
    import datetime
    try:
        days = (today - datetime.date(y, mo, d)).days
    except ValueError:
        return False
    return -1 <= days <= NEW_DAYS

def is_daily(j):
    return (j.get("قبض يومي") or "").strip() == "نعم"

def parse_shifts(txt):
    out = []
    for line in str(txt or "").split("\n"):
        parts = [p.strip() for p in line.split("|")]
        parts = [p for p in parts]
        if not parts or not parts[0]:
            continue
        s = {"h": parts[0], "p30": "", "p26": "", "done": False}
        for x in parts[1:]:
            if x == "مكتمل":
                s["done"] = True
                continue
            m = re.match(r"^(30|26)\s*يوم\s*:\s*(.*)$", x)
            if m:
                s["p" + m.group(1)] = m.group(2).strip()
        if s["h"] or s["p30"] or s["p26"]:
            out.append(s)
    return out

def parse_contacts(j):
    out = []
    if j.get("أرقام التواصل"):
        for line in str(j["أرقام التواصل"]).split("\n"):
            p = [x.strip() for x in line.split("|")]
            if p[0]:
                out.append({"name": p[0] if len(p) > 1 and p[1] else "", "phone": p[1] if len(p) > 1 and p[1] else p[0]})
    return out

P30, P26 = "مرتب 30 يوم", "مرتب 26 يوم"
def pays(j):
    a = []
    if j.get(P30): a.append(("30 يوم عمل", j[P30]))
    if j.get(P26): a.append(("26 يوم عمل + 4 أيام إجازة", j[P26]))
    return a

def is_multi(j):
    return bool(parse_shifts(j.get("الورديات") or ""))

def pay_score(j):
    cands = [j.get(P30, ""), j.get(P26, ""), j.get("المرتب", "")]
    for s in parse_shifts(j.get("الورديات") or ""):
        cands += [s["p30"], s["p26"]]
    m = 0
    for x in cands:
        n = num_of(x)
        if n and re.search(r"اليوم|يومي|يومية", str(x)):
            n *= 26
        if n > m: m = n
    return m

def hours_only(v):
    s = str(v or "").strip()
    m = re.match(r"(\d{1,2})\s*ساعة", s) or re.match(r"(\d{1,2})\s*ساعات", s)
    if m: return m.group(1) + " ساعة"
    return s or "مش محدد"

def city_name(j):
    return re.sub(r"\s*\(.*?\)\s*", " ", str(j.get("المنطقة") or "")).strip()

def job_id(j):
    h = 5381
    for ch in str(j.get("المصنع") or ""):
        h = ((h << 5) + h + ord(ch)) & 0xFFFFFFFF
    return base36(h)

def base36(n):
    chars = "0123456789abcdefghijklmnopqrstuvwxyz"
    if n == 0: return "0"
    out = ""
    while n:
        n, r = divmod(n, 36)
        out = chars[r] + out
    return out

def manual_order(j):
    try:
        return float(j.get("الترتيب") or "nan")
    except ValueError:
        pass
    if (j.get("تثبيت") or "").strip() == "نعم":
        return 0.0
    return None

def rank(j):
    if is_done(j): return 2
    return 0 if manual_order(j) is not None else 1

def visible_jobs(jobs):
    return [j for j in jobs if (j.get("ظاهر؟") or "نعم").strip() != "لا" and j.get("المصنع")]

def sort_jobs(jobs):
    def key(j):
        mo = manual_order(j)
        return (rank(j), mo if mo is not None else 0, -pay_score(j) if rank(j) == 1 else 0)
    return sorted(jobs, key=key)

CITY_SLUGS = [
    (r"أكتوبر|اكتوبر", "6-october", "6 أكتوبر"),
    (r"العاشر|رمضان", "10th-ramadan", "العاشر من رمضان"),
    (r"السادات", "sadat", "السادات"),
    (r"بدر", "badr", "مدينة بدر"),
    (r"العبور", "obour", "العبور"),
]
def city_slug(city):
    for pat, slug, name in CITY_SLUGS:
        if re.search(pat, city):
            return slug + "-daily" if "قبض يومي" in city else slug
    return "area-" + base36(abs(hash(city)) % 36**4)

def group_by_city(jobs):
    groups = {}
    order = []
    for j in jobs:
        c = city_name(j)
        for pat, slug, canon in CITY_SLUGS:
            if re.search(pat, c):
                c = canon
                break
        # مناطق القبض اليومي ليها قسم لوحدها زي الموقع الحالي
        if "قبض يومي" in str(j.get("المنطقة") or ""):
            c = c + " - قبض يومي"
        if c not in groups:
            groups[c] = []
            order.append(c)
        groups[c].append(j)
    order.sort(key=lambda c: -len(groups[c]))
    return order, groups
