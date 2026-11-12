"""Build a chapter page from _src/<slug>/: headings.txt (one per line) + NN.html per section.

Usage: python3 tools/build_chapter.py harchakot
A section file may end with <ol class="notes" start="N">…</ol> for its footnotes.
A "private" chapter keeps its text out of the site and the (public) repository: its sources live in
/mnt/project-files/private/<slug>/, the build writes content.sql there, and the admin runs that file in Supabase once.
The page then loads each section's text from the chapter_text table, which only readers with a live permission can read.
It opens only with its own time-limited permission (see private.js): no quiz, no "קראתי",
and reading is recorded automatically for the admin when the reader reaches the end of a section.
"""
import os, sys, html, hashlib

CHAPTERS = {
    # One version only (Natan, 2026-10-24): icons for each section, and each section's questions on the same page
    # below the text, after a blank gap. "הבא" in the bottom bar opens only once they are all answered.
    "harchakot": dict(title="הרחקות", subtitle="פרק ב - האיסורים הנוהגים בזמן נדתה", num=1, of=3, path="halacha/family/harchakot",
         graphic=True, inline_quiz=True, quiz="/halacha/harchakot/quiz.json",
         # Natan's split into 7 topics (2026-10-28): first section, last section, title.
         # Natan, 2026-11-09: a soft-colored cover picture at the top of each topic (halacha/harchakot/covers/cover-N.png).
         covers=True,
         groups=[(1, 4, "כללי"), (5, 8, "חיי היום יום"), (9, 12, "אכילה ושתייה"), (13, 14, "חדר השינה"),
                 (15, 18, "מחוץ לבית"), (19, 21, "הנהגה אישית"), (22, 26, "מצבים מיוחדים")],
         # Natan, 2026-10-29: the book's name in bold; the second line in his handwriting font (.hand), the font of his own notes.
         credit='מתוך הספר <b>חוסן ישועות</b> מאת הרב דב טברדוביץ שליט&quot;א. באדיבות המחבר'
                '<br><span class="hand">ההערות ב&quot;כתב יד&quot; - מאת הרב נתן גלבשטיין</span>'),
    # דיני יולדת (Natan, 2026-10-28): built like הרחקות, inside מעגל החיים > לידה. Three parts: a theoretical introduction,
    # the chapter itself, and the halachot in brief. Opens with the הרחקות permission (auth.js TREE "with").
    # Questions come once the vocalized text is in (noquiz until then).
    "yoledet": dict(title="דיני יולדת ומפלת", subtitle="מעגל החיים · לידה", num=3, of=3, path="halacha/family/yoledet",
         inline_quiz=True, quiz="/halacha/yoledet/quiz.json", back="/halacha/maagal-hachaim/#leida", note="לידה",
         # Natan, 2026-10-29: the same two credit lines as הרחקות.
         credit='מתוך הספר <b>חוסן ישועות</b> מאת הרב דב טברדוביץ שליט&quot;א. באדיבות המחבר'
                '<br><span class="hand">ההערות ב&quot;כתב יד&quot; - מאת הרב נתן גלבשטיין</span>',
         part_titles=True,
         groups=[(1, 5, "חלק א' - הקדמה עיונית"), (6, 12, "חלק ב' - דיני יולדת ומפלת"), (13, 17, "חלק ג' - ההלכות בקצרה")]),
    "leil-hachatuna": dict(title="סדר ליל החתונה", subtitle="סדר ליל הכלולות", num=2, of=3, path="leil-hachatuna", private=True,
         # Natan, 2026-10-28: three tabs. The first two have no text yet (None = empty tab).
         # The third holds the whole order, read as one long page (flow); the menu scrolls to a heading.
         # Natan, 2026-11-08: every section heading is a page of its own (no long page), and each tab stands apart.
         tabs_apart=True, part_titles=True,
         # Sections 16-23 were added later (2026-10-29) and show before 1-15, in the order of the tabs: the numbers stay, so saved reads stay valid.
         # Natan, 2026-11-08: הלכות צניעות = קיצור שולחן ערוך סימן ק"נ with his notes, sections 24-40 (one per סעיף).
         groups=[(24, 40, "הלכות צניעות"), # Natan, 2026-11-08: the two middle tabs are one tab now, with their names as sub-topic headings inside it.
                 (16, 23, "השקפה", [(16, 17, "ההבדל בין גברים לנשים"), (18, 20, "מקרבה נפשית - לבשר אחד"), (21, 23, "הפיוס שלפני")]), (1, 15, "סדר ליל החתונה",
                 # Inside it, the four topics from the first split, as headings in the list, the menu and the page.
                 [(1, 4, "ההכנות"), (5, 9, "ליל החתונה"), (10, 11, "טומאת בתולים"), (12, 15, "אחרי ליל החתונה")])]),
}

slug = sys.argv[1]
ch = CHAPTERS[slug]
private = ch.get("private", False)
src = f"/mnt/project-files/private/{slug}" if private else f"_src/{ch.get('src', slug)}"
key = ch.get("key", slug)
inline = ch.get("inline_quiz", False)
icons = {}
if ch.get("graphic"):
    sys.dont_write_bytecode = True
    sys.path.insert(0, os.path.dirname(__file__))
    from icons import ICONS
    icons = ICONS[ch.get("src", slug)]
def ico(i, cls):
    return f'<span class="{cls}" aria-hidden="true">{icons[i]}</span>' if i in icons else ""
heads = [h.strip() for h in open(f"{src}/headings.txt", encoding="utf-8") if h.strip()]
# A heading that starts with "~" names the section in the lists and menu only; on the page its words open the text instead (Natan, 2026-11-08).
quiet = {i for i, h in enumerate(heads, 1) if h.startswith("~")}
heads = [h.lstrip("~").strip() for h in heads]

# Man / woman icons beside a halacha that is mainly about one of them (src/who.txt; not listed = both, no icon).
WHO_SVG = {
    "m": '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="2.8" fill="currentColor"/><path fill="currentColor" d="M8.5 9.5h7a2 2 0 0 1 2 2V16h-2v6h-7v-6h-2v-4.5a2 2 0 0 1 2-2z"/></svg>',
    "w": '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="2.8" fill="currentColor"/><path fill="currentColor" d="M9.6 9.5h4.8l3.6 8h-3V22h-6v-4.5H6z"/></svg>',
}
WHO_LABEL = {"m": "דגש לבעל", "w": "הדגשה לאשה"}
def who_icon(k):
    return f'<span class="who who-{k}" role="img" aria-label="{WHO_LABEL[k]}" title="{WHO_LABEL[k]}">{WHO_SVG[k]}</span>'
who = {}
if os.path.exists(f"{src}/who.txt"):
    for line in open(f"{src}/who.txt", encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#"):
            letter, k = line.split()
            who[letter] = k
def add_who(body):
    import re
    body = body.replace("{m}", who_icon("m") + " ").replace("{w}", who_icon("w") + " ")
    return re.sub(r'(<b class="hl">([^<.]+)\.</b>)', lambda m: m.group(1) + (who_icon(who[m.group(2)]) if m.group(2) in who else ""), body)
def heading_who(raw):
    """Icons for a section's heading. All its halachot for one side: the icon alone. Only part of it: the icons in parentheses."""
    import re
    letters = re.findall(r'<b class="hl">([^<.]+)\.</b>', raw)
    kinds = {who[l] for l in letters if l in who} | set(re.findall(r"\{([mw])\}", raw))
    if not kinds:
        return ""
    full = bool(letters) and all(l in who for l in letters) and len(kinds) == 1
    icons = "".join(who_icon(k) for k in "mw" if k in kinds)
    return f'<span class="hw{"" if full else " part"}">{icons}</span>'
WHO_KEY = (f'<p class="who-key">{who_icon("m")} = דגש לבעל<span class="sep">·</span>{who_icon("w")} = הדגשה לאשה<span class="key-note">סמל בסוגריים בכותרת = רק חלק מהסעיף</span></p>' if who else "")
n = len(heads)

# Private chapters: hidden until the reader's permission is confirmed; reading is tracked quietly for the admin.
PRIVATE_HEAD = """<meta name="robots" content="noindex">
<style>main.checking .sec,main.checking .toc,main.priv-locked .sec,main.priv-locked .toc{display:none}.read-end{display:block;height:1px}html:has(main[data-track]) .cb-read{display:none}html:has(main[data-track]){--accent:#2d5f93 !important;--soft:#e8eff8}@media (prefers-color-scheme:dark){html:not([data-theme="light"]):has(main[data-track]){--accent:#8fbbe8 !important;--soft:#18212c}}html[data-theme="dark"]:has(main[data-track]){--accent:#8fbbe8 !important;--soft:#18212c}.content ul.dots,.content ol.nums{margin:0;padding-inline-start:1.4em;display:grid;gap:.55em}.content ul.dots li::marker{color:var(--accent)}</style>
</head><body>
"""
PRIVATE_TAIL = f"""<script src="/private.js"></script>
<script>
(async function(){{
  var main=document.querySelector('main[data-track]'), ch=main.getAttribute('data-track'), gate=document.getElementById('gate');
  var open=await LOCK.paint(gate,'{ch["path"]}');
  main.classList.remove('checking');
  if(!open){{main.classList.add('priv-locked');gate.hidden=false;return}}
  var g=LOCK.grantOf('{ch["path"]}'), u=document.getElementById('until'), st=SITE.state;
  if(g&&g.expires_at&&!st.profile.is_admin){{u.textContent='החלק פתוח לך עד '+LOCK.day(g.expires_at)+'.';u.hidden=false}}
  // The text itself comes from Supabase, and only to readers whose permission is live.
  var t=await SITE.sb.from('chapter_text').select('section,html').eq('chapter',ch);
  (t.data||[]).forEach(function(r){{var c=document.querySelector('#s'+r.section+' .content');if(c)c.innerHTML=r.html}});
  if(t.error||!(t.data||[]).length) [].forEach.call(document.querySelectorAll('.sec .content'),function(c){{
    c.innerHTML='<p class="placeholder">'+(st.profile&&st.profile.is_admin?'הטקסט עוד לא הועלה ל־Supabase. צריך להריץ שם את v5.sql ואת קובץ התוכן של החלק.':'הטקסט לא נטען. נסה לרענן את הדף.')+'</p>'}});
  if(!st.user||st.profile&&st.profile.is_admin) return;
  // A section counts as read only at reading pace (Natan, 2026-11-08): it must stay in the middle of the screen
  // long enough for its length (about a quarter second a word, at least 8 seconds), and its end must come into view.
  // Fast scrolling past it is not counted. Only the admin sees this.
  // The reader's own "קראתי" mark (Natan, 2026-11-08), kept apart from the measured reading: reads rows under '<chapter>:v'.
  try{{(await SITE.loadReads(ch+':v')||[]).forEach(function(n){{var b=document.querySelector('[data-vread="'+n+'"]');if(b)b.checked=true}})}}catch(e){{}}
  document.addEventListener('change',function(e){{var b=e.target.closest('[data-vread]');if(b)SITE.saveRead(ch+':v',b.getAttribute('data-vread'),b.checked)}});
  var done={{}}, spent={{}}, need={{}}, ended={{}};
  try{{(await SITE.loadReads(ch)||[]).forEach(function(n){{done[n]=1}})}}catch(e){{}}
  [].forEach.call(document.querySelectorAll('.sec'),function(sec){{var n=sec.id.slice(1), c=sec.querySelector('.content');
    var w=((c&&c.textContent)||'').trim().split(/\\s+/).length;need[n]=Math.max(8000,w*250)}});
  var io=new IntersectionObserver(function(es){{es.forEach(function(e){{if(e.isIntersecting)ended[e.target.getAttribute('data-end')]=1}})}});
  [].forEach.call(document.querySelectorAll('.read-end'),function(el){{io.observe(el)}});
  setInterval(function(){{
    if(document.hidden)return;
    var h=innerHeight;
    [].forEach.call(document.querySelectorAll('.sec:not([hidden])'),function(sec){{
      var n=sec.id.slice(1);if(done[n])return;
      var r=sec.getBoundingClientRect();if(r.height===0||r.bottom<h*0.2||r.top>h*0.8)return;
      spent[n]=(spent[n]||0)+1000;
      if(ended[n]&&spent[n]>=need[n]){{done[n]=1;SITE.saveRead(ch,n,true)}}
    }});
  }},1000);
}})();
</script>
"""

# Inline questions: a blank gap after the text (styled later), then the section's questions, filled in by chapter.js.
INLINE_Q = f"""
    <div class="q-gap"><button type="button" class="to-quiz" data-quiz-open="{{i}}">לשאלון</button></div>
    <div class="iq" data-iq="{{i}}" id="q{{i}}"></div>"""

# Reading order: the order of the tabs (a section outside every tab comes after, by number).
order = [i for g in ch.get("groups", []) if g[0] is not None for i in range(g[0], g[1] + 1)]
order += [i for i in range(1, len(heads) + 1) if i not in order]
assert sorted(order) == list(range(1, len(heads) + 1))
pos = {i: k for k, i in enumerate(order)}  # 0-based place in the reading order
# Natan, 2026-11-11: when each tab stands apart, the visible numbers count inside the tab (1, 2, 3 ...), in reading order.
shown = {i: i for i in range(1, len(heads) + 1)}
tabn = {}
if ch.get("tabs_apart"):
    for g in ch.get("groups", []):
        if g[0] is None: continue
        for k, i in enumerate(range(g[0], g[1] + 1), 1): shown[i] = k; tabn[i] = g[1] - g[0] + 1

toc, secs, private_rows = [], [], []
for i, h in enumerate(heads, 1):
    path = f"{src}/{i:02d}.html"
    if os.path.exists(path):
        raw = open(path, encoding="utf-8").read().strip()
        hw = heading_who(raw)
        body = add_who(raw)
        filled = True
        if private:
            private_rows.append((i, body))
            body = '<p class="msg">טוען…</p>'
    else:
        body = '<p class="placeholder">הטקסט של הסעיף הזה עוד לא נוסף.</p>'
        hw = ""
        filled = False
    toc.append(f'<li><a href="#s{i}"{"" if filled else " class=\"empty\""}><span class="num">{shown[i]}</span>{ico(i, "ico")}{html.escape(h)}{hw}</a></li>')
    k = pos[i]; pi = order[k - 1] if k > 0 else None; ni = order[k + 1] if k + 1 < n else None
    prev = (f'<a class="pn prev" href="#s{pi}"><small>הקודם</small>{html.escape(heads[pi-1])}</a>' if pi
            else f'<a class="pn prev" href="{ch.get("back", "/halacha/")}"><small>חזרה</small>לתפריט הלכה</a>')
    mid = '<button type="button" class="pn mid" data-open-toc><small>תפריט</small>כל הכותרות</button>'
    nxt = f'<a class="pn next" href="#s{ni}"><small>הבא</small>{html.escape(heads[ni-1])}</a>' if ni else '<span></span>'
    secs.append(f'''  <section class="sec" id="s{i}" aria-labelledby="s{i}-h">
    <div class="sec-head{" no-h" if i in quiet else ""}">{ico(i, "sec-ico")}<h2 id="s{i}-h">{html.escape(h)}{hw}</h2><span class="sec-num" aria-label="סעיף {shown[i] if i in tabn else k+1} מתוך {tabn.get(i, n)}">{shown[i] if i in tabn else k+1}/{tabn.get(i, n)}</span></div>
    <div class="content">
{body}
    </div>{f'<i class="read-end" data-end="{i}"></i><label class="v-read"><input type="checkbox" data-vread="{i}"><span>קראתי</span></label>' if private else ""}{INLINE_Q.format(i=i) if inline else ""}
    <div class="sec-foot">
      {"" if private else f'<div class="sec-tools"><label class="read-mark"><input type="checkbox" data-read="{i}"><span>קראתי</span></label>{"" if inline or ch.get("noquiz") else f'<button type="button" class="quiz-btn" data-quiz="{i}">בחינה עצמית</button>'}</div>'}
      <nav class="pager" aria-label="ניווט בין סעיפים">{prev}{mid}{nxt}</nav>
    </div>
  </section>''')

# The headings list: one plain list, or, when the chapter has topics, one tab per topic that opens its own list.
groups = ch.get("groups")
if groups:
    full = [x for x in groups if x[0] is not None]
    rng = sorted(full)
    assert rng[0][0] == 1 and rng[-1][1] == n and all(a[1] + 1 == b[0] for a, b in zip(rng, rng[1:]))
    subs = {}  # first section of a sub-topic -> its title
    def items(a, b, sub):
        out = []
        for i in range(a, b + 1):
            for x in sub:
                if x[0] == i:
                    subs[i] = x[2]
                    out.append(f'<li class="toc-sub">{html.escape(x[2])}</li>')
            out.append(toc[i - 1])
        return "".join(out)
    def grp(g, a, b, t, sub=()):
        if a is None:  # a tab whose text has not been written yet
            return (f'<details class="grp" name="grp"><summary><span class="num">{g}</span><span class="g-title">{html.escape(t)}</span></summary>'
                    '<p class="grp-empty">התוכן של הלשונית הזו ייכתב בהמשך.</p></details>')
        return (f'<details class="grp" name="grp" data-from="{a}" data-to="{b}"><summary><span class="num">{g}</span><span class="g-title">{html.escape(t)}</span>'
                f'<small>{"סעיפים "+str(shown[a])+"-"+str(shown[b]) if b > a else "סעיף "+str(shown[a])}</small></summary>'
                f'<ol>{items(a, b, sub)}</ol></details>')
    toc_html = '<div class="grps">' + "".join(grp(g, *x) for g, x in enumerate(groups, 1)) + '</div>'
    # A sub-topic title above its first section on the page (shown only once inside the long page).
    for i, t in subs.items():
        secs[i - 1] = f'  <h2 class="part-head">{html.escape(t)}</h2>\n' + secs[i - 1]
    # A big centered part title at the top of the first section of each part.
    if ch.get("part_titles"):
        for x in full:
            a, t = x[0], x[2]
            if ch.get("flow"):  # one long page: the tab title stands above the section (and its sub-topic title)
                secs[a - 1] = f'  <h2 class="part-title flow-pt">{html.escape(t)}</h2>\n' + secs[a - 1]
                continue
            head, rest = secs[a - 1].split("\n", 1)
            secs[a - 1] = f'{head}\n    <h2 class="part-title">{html.escape(t)}</h2>\n{rest}'
    # A cover picture at the top of the first section of each topic, when its file exists.
    if ch.get("covers"):
        for g, x in enumerate(full, 1):
            f = f"covers/cover-{g}.png"
            if os.path.exists(f"halacha/{slug}/{f}"):
                head, rest = secs[x[0] - 1].split("\n", 1)
                secs[x[0] - 1] = f'{head}\n    <img class="cover" src="{f}" alt="" width="1024" height="572" loading="lazy">\n{rest}'
        # Natan, 2026-11-09: a section picture under the section's heading, when pics/sN.png exists.
        for i in range(1, n + 1):
            f = f"pics/s{i}.png"
            if os.path.exists(f"halacha/{slug}/{f}"):
                a, b = secs[i - 1].split('<div class="content">', 1)
                secs[i - 1] = f'{a}<img class="sec-pic" src="{f}" alt="" width="1024" height="572" loading="lazy">\n    <div class="content">{b}'
else:
    toc_html = "<ol>\n      " + chr(10).join("      "+t for t in toc).strip() + "\n    </ol>"

def ver(name):
    # A short fingerprint of the file, so phones fetch the new style.css / chapter.js right after a change instead of a cached copy.
    return hashlib.md5(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', name), 'rb').read()).hexdigest()[:8]

page = f'''<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{ch["title"]} · הלכה</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@500;700&family=Assistant:wght@400;600&family=Gveret+Levin&display=swap">
<link rel="stylesheet" href="/style.css?v={ver("style.css")}">
{PRIVATE_HEAD if private else "</head><body>"+chr(10)}<main dir="rtl" lang="he" class="chapter{" checking" if private else ""}" {f'data-track="{slug}"' if private else f'data-chapter="{key}" data-path="{ch["path"]}"'}{f' data-quiz="{ch["quiz"]}"' if ch.get("quiz") else ""}{" data-inline-quiz" if inline else ""}{" data-flow" if ch.get("flow") else ""}{" data-tabs-apart" if ch.get("tabs_apart") else ""}>
  <header>
    <a class="back" href="{ch.get("back", "/halacha/")}">→ חזרה{" ללידה" if ch.get("back") else " להלכה"}</a>
    <div class="eyebrow">הלכה · חלק {ch["num"]} מתוך {ch["of"]}{" · "+ch["note"] if ch.get("note") else ""}</div>
    <h1>{ch["title"]}</h1>
    {f'<p class="lead">{ch["subtitle"]}</p>' if ch.get("subtitle") else ""}
    {'<p class="until" id="until" hidden></p>' if private else ""}
    {f'<p class="credit">{ch["credit"]}</p>' if ch.get("credit") else ""}
  </header>

  {'<div id="gate" hidden></div>' if private else ""}
  <details class="toc" id="toc">
    <summary><span>תוכן עניינים</span><span class="toc-count" data-total="{n}">{n} סעיפים</span></summary>
    {WHO_KEY}
    {toc_html}
  </details>

{chr(10).join(secs[i - 1] for i in order)}

  <footer>
    <span>נבנה בהדרגה, צעד אחר צעד.</span>
    <button id="theme" type="button">מצב כהה</button>
  </footer>
</main>
<script src="/site.js"></script>
<script src="/vendor/supabase.js"></script>
<script src="/auth.js"></script>
<script src="/chapter.js?v={ver("chapter.js")}"></script>
{PRIVATE_TAIL if private else ""}</body></html>
'''
if private:
    sql = ["-- Text of the chapter. Supabase: SQL Editor -> New query -> paste -> Run. Safe to run again (replaces the text).",
           f"delete from public.chapter_text where chapter = '{slug}';"]
    for i, body in private_rows:
        assert "$t$" not in body
        sql.append(f"insert into public.chapter_text (chapter, section, html) values ('{slug}', {i}, $t${body}$t$);")
    open(f"{src}/content.sql", "w", encoding="utf-8").write("\n".join(sql) + "\n")
    print(f"wrote {src}/content.sql ({len(private_rows)} sections)")
os.makedirs(f"halacha/{slug}", exist_ok=True)
open(f"halacha/{slug}/index.html", "w", encoding="utf-8").write(page)
print(f"built halacha/{slug}/ with {n} sections")
