"""Build a chapter page from _src/<slug>/: headings.txt (one per line) + NN.html per section.

Usage: python3 tools/build_chapter.py harchakot
A section file may end with <ol class="notes" start="N">…</ol> for its footnotes.
A "private" chapter keeps its text out of the site and the (public) repository: its sources live in
/mnt/project-files/private/<slug>/, the build writes content.sql there, and the admin runs that file in Supabase once.
The page then loads each section's text from the chapter_text table, which only readers with a live permission can read.
It opens only with its own time-limited permission (see private.js): no quiz, no "קראתי",
and reading is recorded automatically for the admin when the reader reaches the end of a section.
"""
import os, sys, html

CHAPTERS = {
    # One version only (Natan, 2026-10-24): icons for each section, and each section's questions on the same page
    # below the text, after a blank gap. "הבא" in the bottom bar opens only once they are all answered.
    "harchakot": dict(title="הרחקות", subtitle="פרק ב – האיסורים הנוהגים בזמן נדתה", num=1, of=2, path="halacha/family/harchakot",
         graphic=True, inline_quiz=True, quiz="/halacha/harchakot/quiz.json",
         credit='מאת הרב דב טברדוביץ · פורסם באתר <a href="https://abc770.org/article_node_2420/" rel="noopener">אור אין סוף</a>, כ״ז אדר א׳ תשע״ד'),
    "leil-hachatuna": dict(title="סדר ליל החתונה", subtitle="סדר ליל הכלולות", num=3, of=3, path="leil-hachatuna", private=True),
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
  if(g&&g.expires_at&&!st.profile.is_admin){{u.textContent='הפרק פתוח לך עד '+LOCK.day(g.expires_at)+'.';u.hidden=false}}
  // The text itself comes from Supabase, and only to readers whose permission is live.
  var t=await SITE.sb.from('chapter_text').select('section,html').eq('chapter',ch);
  (t.data||[]).forEach(function(r){{var c=document.querySelector('#s'+r.section+' .content');if(c)c.innerHTML=r.html}});
  if(t.error||!(t.data||[]).length) [].forEach.call(document.querySelectorAll('.sec .content'),function(c){{
    c.innerHTML='<p class="placeholder">'+(st.profile&&st.profile.is_admin?'הטקסט עוד לא הועלה ל־Supabase. צריך להריץ שם את v5.sql ואת קובץ התוכן של הפרק.':'הטקסט לא נטען. נסה לרענן את הדף.')+'</p>'}});
  if(!st.user||st.profile&&st.profile.is_admin) return;
  // A section counts as read when its end comes into view after at least 15 seconds on it. Only the admin sees this.
  var done={{}}, since={{}};
  try{{(await SITE.loadReads(ch)||[]).forEach(function(n){{done[n]=1}})}}catch(e){{}}
  var io=new IntersectionObserver(function(es){{es.forEach(function(e){{
    var n=e.target.getAttribute('data-end'), sec=e.target.closest('.sec');
    if(!e.isIntersecting||done[n]||sec.hidden) return;
    var wait=15000-(Date.now()-(since[n]||Date.now()));
    setTimeout(function(){{ if(!done[n]&&!sec.hidden){{done[n]=1;SITE.saveRead(ch,n,true)}} }},Math.max(0,wait));
  }})}},{{rootMargin:'0px 0px 30% 0px'}});
  [].forEach.call(document.querySelectorAll('.read-end'),function(el){{io.observe(el)}});
  function seen(){{var s=document.querySelector('.sec:not([hidden])');if(s){{var n=s.id.slice(1);if(!since[n])since[n]=Date.now()}}}}
  seen();window.addEventListener('hashchange',seen);
}})();
</script>
"""

# Inline questions: a blank gap after the text (styled later), then the section's questions, filled in by chapter.js.
INLINE_Q = f"""
    <div class="q-gap">{"".join('<span>↓ השאלון למטה ↓</span>' for _ in range(4))}</div>
    <div class="iq" data-iq="{{i}}" id="q{{i}}"></div>"""

toc, secs, private_rows = [], [], []
for i, h in enumerate(heads, 1):
    path = f"{src}/{i:02d}.html"
    if os.path.exists(path):
        body = open(path, encoding="utf-8").read().strip()
        filled = True
        if private:
            private_rows.append((i, body))
            body = '<p class="msg">טוען…</p>'
    else:
        body = '<p class="placeholder">הטקסט של הקטע הזה עוד לא נוסף.</p>'
        filled = False
    toc.append(f'<li><a href="#s{i}"{"" if filled else " class=\"empty\""}><span class="num">{i}</span>{ico(i, "ico")}{html.escape(h)}</a></li>')
    prev = (f'<a class="pn prev" href="#s{i-1}"><small>הקודם</small>{html.escape(heads[i-2])}</a>' if i > 1
            else '<a class="pn prev" href="/halacha/"><small>חזרה</small>לתפריט הלכה</a>')
    mid = '<button type="button" class="pn mid" data-open-toc><small>תפריט</small>כל הכותרות</button>'
    nxt = f'<a class="pn next" href="#s{i+1}"><small>הבא</small>{html.escape(heads[i])}</a>' if i < n else '<span></span>'
    secs.append(f'''  <section class="sec" id="s{i}" aria-labelledby="s{i}-h">
    <div class="sec-head">{ico(i, "sec-ico")}<h2 id="s{i}-h">{html.escape(h)}</h2><span class="sec-num" aria-label="קטע {i} מתוך {n}">{i}/{n}</span></div>
    <div class="content">
{body}
    </div>{f'<i class="read-end" data-end="{i}"></i>' if private else ""}{INLINE_Q.format(i=i) if inline else ""}
    <div class="sec-foot">
      {"" if private else f'<div class="sec-tools"><label class="read-mark"><input type="checkbox" data-read="{i}"><span>קראתי</span></label>{"" if inline else f'<button type="button" class="quiz-btn" data-quiz="{i}">בחינה עצמית</button>'}</div>'}
      <nav class="pager" aria-label="ניווט בין קטעים">{prev}{mid}{nxt}</nav>
    </div>
  </section>''')

page = f'''<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{ch["title"]} · הלכה</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@500;700&family=Assistant:wght@400;600&display=swap">
<link rel="stylesheet" href="/style.css">
{PRIVATE_HEAD if private else "</head><body>"+chr(10)}<main dir="rtl" lang="he" class="chapter{" checking" if private else ""}" {f'data-track="{slug}"' if private else f'data-chapter="{key}" data-path="{ch["path"]}"'}{f' data-quiz="{ch["quiz"]}"' if ch.get("quiz") else ""}{" data-inline-quiz" if inline else ""}>
  <header>
    <a class="back" href="/halacha/">→ חזרה להלכה</a>
    <div class="eyebrow">הלכה · פרק {ch["num"]} מתוך {ch["of"]}{" · "+ch["note"] if ch.get("note") else ""}</div>
    <h1>{ch["title"]}</h1>
    {f'<p class="lead">{ch["subtitle"]}</p>' if ch.get("subtitle") else ""}
    {'<p class="until" id="until" hidden></p>' if private else ""}
    {f'<p class="credit">{ch["credit"]}</p>' if ch.get("credit") else ""}
  </header>

  {'<div id="gate" hidden></div>' if private else ""}
  <details class="toc" id="toc">
    <summary><span>תוכן עניינים</span><span class="toc-count" data-total="{n}">{n} קטעים</span></summary>
    <ol>
      {chr(10).join("      "+t for t in toc).strip()}
    </ol>
  </details>

{chr(10).join(secs)}

  <footer>
    <span>נבנה בהדרגה, צעד אחר צעד.</span>
    <button id="theme" type="button">מצב כהה</button>
  </footer>
</main>
<script src="/site.js"></script>
<script src="/vendor/supabase.js"></script>
<script src="/auth.js"></script>
<script src="/chapter.js"></script>
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
