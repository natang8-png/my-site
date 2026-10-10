"""Convert _raw/*.txt (vocalized sections) into _src/<chapter>/NN.html.

Raw format: '=== NN' header, body HTML with ⟦n⟧ footnote markers, a '---' line,
then notes as 'n: text ¶ second paragraph'.
"""
import re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent


def wrap_brackets(p):
    # Wrap top-level [...] in a muted span, unless the whole paragraph is bracketed.
    inner = re.sub(r'^<p>|</p>$', '', p)
    if re.fullmatch(r'\[[^\]]*(\[[^\]]*\][^\]]*)*\](⟦\d+⟧)?\.?', inner.strip()):
        return p
    out, depth, start = [], 0, None
    for i, c in enumerate(p):
        if c == '[':
            if depth == 0:
                out.append('<span class="br">')
            depth += 1
        out.append(c)
        if c == ']' and depth > 0:
            depth -= 1
            if depth == 0:
                out.append('</span>')
    return ''.join(out)


def fn(m):
    n = m.group(1)
    return f'<sup class="fn"><a href="#n{n}" id="r{n}">{n}</a></sup>'


def convert(chapter, raw):
    text = raw.read_text(encoding='utf-8')
    for block in re.split(r'^=== ', text, flags=re.M)[1:]:
        num, rest = block.split('\n', 1)
        body, _, notes = rest.partition('\n---\n')
        paras = [wrap_brackets(l) for l in body.strip().splitlines() if l.strip()]
        html = '\n'.join(re.sub(r'⟦(\d+)⟧', fn, p) for p in paras)
        items = []
        for line in notes.strip().splitlines():
            m = re.match(r'(\d+):\s*(.*)', line)
            if not m:
                continue
            n, t = m.groups()
            ps = [s.strip() for s in t.split('¶')]
            ps[-1] += f' <a class="nb" href="#r{n}" aria-label="חזרה לטקסט">↩</a>'
            items.append(f'<li id="n{n}" value="{n}">' + ''.join(f'<p>{s}</p>' for s in ps) + '</li>')
        if items:
            html += '\n<ol class="notes">\n' + '\n'.join(items) + '\n</ol>'
        out = ROOT / '_src' / chapter / f'{num.strip()}.html'
        out.write_text(html + '\n', encoding='utf-8')
        print(out.name, len(paras), 'paras', len(items), 'notes')


if __name__ == '__main__':
    chapter = sys.argv[1]
    for f in sys.argv[2:]:
        convert(chapter, pathlib.Path(f))
