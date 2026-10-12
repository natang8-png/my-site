"""Build a chapter page from _src/<slug>/: headings.txt (one per line) + NN.html per section.

Usage: python3 tools/build_chapter.py harchakot
A section file may end with <ol class="notes" start="N">…</ol> for its footnotes.
"""
import os, sys, html

CHAPTERS = {
    "harchakot": dict(title="הרחקות", subtitle="פרק ב – האיסורים הנוהגים בזמן נדתה", num=1, of=2, path="halacha/family/harchakot",
         credit='מאת הרב דב טברדוביץ · פורסם באתר <a href="https://abc770.org/article_node_2420/" rel="noopener">אור אין סוף</a>, כ״ז אדר א׳ תשע״ד'),
}

slug = sys.argv[1]
ch = CHAPTERS[slug]
src = f"_src/{slug}"
heads = [h.strip() for h in open(f"{src}/headings.txt", encoding="utf-8") if h.strip()]
n = len(heads)

toc, secs = [], []
for i, h in enumerate(heads, 1):
    path = f"{src}/{i:02d}.html"
    if os.path.exists(path):
        body = open(path, encoding="utf-8").read().strip()
        filled = True
    else:
        body = '<p class="placeholder">הטקסט של הקטע הזה עוד לא נוסף.</p>'
        filled = False
    toc.append(f'<li><a href="#s{i}"{"" if filled else " class=\"empty\""}><span class="num">{i}</span>{html.escape(h)}</a></li>')
    prev = (f'<a class="pn prev" href="#s{i-1}"><small>הקודם</small>{html.escape(heads[i-2])}</a>' if i > 1
            else '<a class="pn prev" href="/halacha/"><small>חזרה</small>לתפריט הלכה</a>')
    mid = '<button type="button" class="pn mid" data-open-toc><small>תפריט</small>כל הכותרות</button>'
    nxt = f'<a class="pn next" href="#s{i+1}"><small>הבא</small>{html.escape(heads[i])}</a>' if i < n else '<span></span>'
    secs.append(f'''  <section class="sec" id="s{i}" aria-labelledby="s{i}-h">
    <div class="sec-head"><h2 id="s{i}-h">{html.escape(h)}</h2><span class="sec-num" aria-label="קטע {i} מתוך {n}">{i}/{n}</span></div>
    <div class="content">
{body}
    </div>
    <div class="sec-foot">
      <div class="sec-tools"><label class="read-mark"><input type="checkbox" data-read="{i}"><span>קראתי</span></label><button type="button" class="quiz-btn" data-quiz="{i}">בחינה עצמית</button></div>
      <nav class="pager" aria-label="ניווט בין קטעים">{prev}{mid}{nxt}</nav>
    </div>
  </section>''')

page = f'''<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{ch["title"]} · הלכה</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@500;700&family=Assistant:wght@400;600&display=swap">
<link rel="stylesheet" href="/style.css">
</head><body>
<main dir="rtl" lang="he" class="chapter" data-chapter="{slug}" data-path="{ch["path"]}">
  <header>
    <a class="back" href="/halacha/">→ חזרה להלכה</a>
    <div class="eyebrow">הלכה · פרק {ch["num"]} מתוך {ch["of"]}</div>
    <h1>{ch["title"]}</h1>
    <p class="lead">{ch["subtitle"]}</p>
    {f'<p class="credit">{ch["credit"]}</p>' if ch.get("credit") else ""}
  </header>

  <details class="toc" id="toc">
    <summary><span>כל הכותרות</span><span class="toc-count" data-total="{n}">{n} קטעים</span></summary>
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
</body></html>
'''
os.makedirs(f"halacha/{slug}", exist_ok=True)
open(f"halacha/{slug}/index.html", "w", encoding="utf-8").write(page)
print(f"built halacha/{slug}/ with {n} sections")
