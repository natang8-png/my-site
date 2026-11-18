#!/usr/bin/env python3
"""שער שלום בית: builds /shalom-bayit/ (the gate) and one page per article from _src/shalom-bayit/articles.md.

Each article starts with a line "## <slug> | <title>". Inside: ### sub-headings, paragraphs, - lists, 1. lists,
**bold** and simple pipe tables. Run: python3 tools/build_shalom.py
Each article opens with its own grant ('shalom-bayit/<slug>'); a grant on 'shalom-bayit' opens them all.
"""
import html, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, '_src', 'shalom-bayit', 'articles.md')
OUT = os.path.join(ROOT, 'shalom-bayit')

HEAD = '''<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} · הלכה בבית</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@500;700&family=Assistant:wght@400;600&display=swap">
<link rel="stylesheet" href="/style.css">
<style>main.gate-wait{{visibility:hidden}}main.home>header{{border-bottom:3px solid var(--accent);padding-bottom:14px}}.topic{{position:relative}}
.acct a,.crumbs a{{color:var(--accent)}}
.art h2{{font-family:var(--display);color:var(--accent);font-weight:700;font-size:1.35rem;margin:28px 0 8px}}
.art p{{margin:0 0 12px;line-height:1.75}}.art ul,.art ol{{margin:0 0 12px;padding-inline-start:1.3em;line-height:1.75}}.art li{{margin-bottom:4px}}
.art table{{border-collapse:collapse;width:100%;margin:8px 0 16px;font-size:.95rem}}.art th,.art td{{border:1px solid var(--line);padding:6px 8px;text-align:right;vertical-align:top}}.art th{{background:var(--soft)}}
.lead{{font-size:1.08rem}}.pager{{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:28px}}.pager a{{display:inline-flex;align-items:center;gap:6px;justify-content:center;text-align:center;padding:10px 14px;border:1px solid var(--accent);border-radius:14px;background:var(--soft);color:var(--accent);font-weight:600;text-decoration:none;max-width:100%}}.pager a:hover,.pager a:focus-visible{{background:var(--accent);color:var(--bg)}}</style>
</head><body>
'''
TAIL_SCRIPTS = '''<script src="/site.js"></script>
<script src="/vendor/supabase.js"></script>
<script src="/auth.js"></script>
<script src="/private.js"></script>
'''
FOOT = '''  <footer>
    <span>נבנה בהדרגה, צעד אחר צעד.</span>
    <button id="theme" type="button">מצב כהה</button>
  </footer>
</main>
'''


def inline(t):
    t = html.escape(t, quote=False)
    return re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', t)


def body(md):
    out, lines, i = [], md.strip('\n').split('\n'), 0
    while i < len(lines):
        l = lines[i]
        if not l.strip():
            i += 1; continue
        if l.startswith('### '):
            out.append('<h2>%s</h2>' % inline(l[4:])); i += 1; continue
        if l.startswith('|'):
            rows = []
            while i < len(lines) and lines[i].startswith('|'):
                cells = [c.strip() for c in lines[i].strip('|').split('|')]
                if not all(re.fullmatch(r'-+', c) for c in cells): rows.append(cells)
                i += 1
            h = '<tr>' + ''.join('<th>%s</th>' % inline(c) for c in rows[0]) + '</tr>'
            b = ''.join('<tr>' + ''.join('<td>%s</td>' % inline(c) for c in r) + '</tr>' for r in rows[1:])
            out.append('<table><thead>%s</thead><tbody>%s</tbody></table>' % (h, b)); continue
        m = re.match(r'(- |\d+\. )', l)
        if m:
            tag = 'ul' if m.group(1) == '- ' else 'ol'; items = []
            while i < len(lines) and re.match(r'(- |\d+\. )', lines[i]):
                items.append(re.sub(r'^(- |\d+\. )', '', lines[i])); i += 1
            out.append('<%s>%s</%s>' % (tag, ''.join('<li>%s</li>' % inline(x) for x in items), tag)); continue
        out.append('<p>%s</p>' % inline(l)); i += 1
    if out and out[0].startswith('<p>'): out[0] = out[0].replace('<p>', '<p class="lead">', 1)
    return '\n'.join(out)


def main():
    text = open(SRC, encoding='utf-8').read()
    parts = re.split(r'^## (\S+) \| (.+)$', text, flags=re.M)[1:]
    arts = [(parts[k], parts[k + 1].strip(), parts[k + 2]) for k in range(0, len(parts), 3)]
    os.makedirs(OUT, exist_ok=True)

    # The gate page: every article is a מדור card; a closed one is grey with "הגש בקשה".
    cards = ''.join(
        '      <li><div class="topic" data-lock="shalom-bayit/%s"><h3><a class="stretch" href="/shalom-bayit/%s/" data-lock="shalom-bayit/%s"><span class="num">%d</span>%s</a></h3>'
        '<p class="req-hint" style="margin:0;color:var(--muted);font-size:.92rem">הגש בקשה</p><span class="go" aria-hidden="true">←</span></div></li>\n'
        % (s, s, s, n + 1, html.escape(t)) for n, (s, t, _) in enumerate(arts))
    gate = HEAD.format(title='שער שלום בית') + '''<main dir="rtl" lang="he" class="home gate-wait">
  <header>
    <nav class="crumbs" aria-label="ניווט"><a href="/">בית</a><span class="tri" dir="ltr" aria-hidden="true">&lt;</span><span class="cur">שער שלום בית</span></nav>
    <h1>שער שלום בית</h1>
  </header>

  <section aria-labelledby="sub-h">
    <h2 id="sub-h">מאמרים</h2>
    <ol class="topics">
''' + cards + '''    </ol>
  </section>

''' + FOOT + TAIL_SCRIPTS + '''<script>
(function(){
  if(!window.SITE){document.querySelector('main').classList.remove('gate-wait');return}
  SITE.ready.then(function(st){
    // Guests never see the מדורים of a gate: straight to sign-in (as in the other gates).
    if(!st.user){location.replace('/login/?next='+encodeURIComponent(location.pathname));return}
    document.querySelector('main').classList.remove('gate-wait');
    [].forEach.call(document.querySelectorAll('.topic[data-lock]'),function(t){if(SITE.access(t.getAttribute('data-lock'))){var h=t.querySelector('.req-hint');if(h)h.hidden=true}else t.classList.add('off')});
  });
})();
</script>
</body></html>
'''
    open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(gate)

    for n, (slug, title, md) in enumerate(arts):
        prev = arts[n - 1] if n else None
        nxt = arts[n + 1] if n + 1 < len(arts) else None
        pager = '<nav class="pager" aria-label="מאמרים">' + \
            ('<a href="/shalom-bayit/%s/">→ %s</a>' % (prev[0], html.escape(prev[1])) if prev else '<a href="/shalom-bayit/">→ שער שלום בית</a>') + \
            ('<a href="/shalom-bayit/%s/">%s ←</a>' % (nxt[0], html.escape(nxt[1])) if nxt else '<span></span>') + '</nav>'
        page = HEAD.format(title=html.escape(title)) + '''<main dir="rtl" lang="he" class="home gate-wait">
  <header>
    <nav class="crumbs" aria-label="ניווט"><a href="/">בית</a><span class="tri" dir="ltr" aria-hidden="true">&lt;</span><a href="/shalom-bayit/">שער שלום בית</a><span class="tri" dir="ltr" aria-hidden="true">&lt;</span><span class="cur">%s</span></nav>
    <h1>%s</h1>
  </header>
  <div id="lockbox" hidden></div>
  <article class="art" hidden>
%s
%s
  </article>

''' % (html.escape(title), html.escape(title), body(md), pager) + FOOT + TAIL_SCRIPTS + '''<script>
// The article shows only to a reader with a grant on it (or on all of שער שלום בית), and to the admin.
(function(){
  var path='shalom-bayit/%s', m=document.querySelector('main');
  if(!window.SITE||!window.LOCK){m.classList.remove('gate-wait');return}
  SITE.ready.then(async function(st){
    if(!st.user){location.replace('/login/?next='+encodeURIComponent(location.pathname));return}
    var box=document.getElementById('lockbox');
    if(await LOCK.paint(box,path,false)) document.querySelector('article').hidden=false; else box.hidden=false;
    m.classList.remove('gate-wait');
  });
})();
</script>
</body></html>
''' % slug
        os.makedirs(os.path.join(OUT, slug), exist_ok=True)
        open(os.path.join(OUT, slug, 'index.html'), 'w', encoding='utf-8').write(page)
    print('built shalom-bayit/ with', len(arts), 'articles:', ', '.join(a[0] for a in arts))


if __name__ == '__main__':
    main()
