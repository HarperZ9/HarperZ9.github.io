"""Render the public career pages and text exports from one reviewed source.

No network access and no private inputs. Run --check in CI to reject drift.
PDF/DOCX generation is handled by build_career_artifacts.py after this step.
"""
from __future__ import annotations

import argparse
from html import escape
import json
import hashlib
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'career' / 'resume-source.json'
ALLOWED_KINDS = {'h1', 'h2', 'h3', 'p', 'li', 'contact', 'subtitle', 'meta', 'pagebreak'}


def expand(blocks: list[dict], groups: dict, stack: tuple[str, ...] = ()) -> list[dict]:
    result = []
    for block in blocks:
        if 'ref' in block:
            key = block['ref']
            if key in stack or key not in groups:
                raise ValueError(f'cyclic or missing career group: {key}')
            result.extend(expand(groups[key], groups, stack + (key,)))
        else:
            if block.get('kind') not in ALLOWED_KINDS or not isinstance(block.get('text'), str):
                raise ValueError('invalid career block')
            result.append(block)
    return result


def linkify(text: str) -> str:
    pattern = r'(?:https?://)?(?:github\.com/|harperz9\.github\.io(?:/|\b)|linkedin\.com/|orcid\.org/|doi\.org/)[^\s|]*'
    parts, previous = [], 0
    for match in re.finditer(pattern, text):
        end = match.end()
        label = match.group().rstrip('.,;')
        parts.append(escape(text[previous:match.start()]))
        url = label if label.startswith('http') else 'https://' + label
        parts.append(f'<a href="{escape(url, quote=True)}">{escape(label)}</a>')
        parts.append(escape(text[match.start() + len(label):end]))
        previous = end
    parts.append(escape(text[previous:]))
    return ''.join(parts)


def contacts(text: str) -> str:
    fields = []
    for field in text.split(' | '):
        value = (f'<a href="mailto:{escape(field, quote=True)}">{escape(field)}</a>'
                 if '@' in field else linkify(field))
        fields.append(f'<span>{value}</span>')
    return '<p class="contact contact--fields">' + ''.join(fields) + '</p>'


def fields(tag: str, text: str, cls: str = '', *, links: bool = True) -> str:
    """A line of ' | '-separated fields as segment spans; the page draws the separators.

    The artifact builder reads the same text back: inside a <p> it puts ' | ' between
    spans itself, and inside an <h3> it reads the text as is, so there the bar stays in
    the markup in a visually hidden span. The PDF, DOCX and text exports are unchanged.
    """
    render = linkify if links else escape
    segments = [f'<span>{render(segment)}</span>' for segment in text.split(' | ')]
    joiner = '<span class="career-sep"> | </span>' if tag == 'h3' else ''
    classes = f'{cls} career-fields'.strip()
    return f'<{tag} class="{classes}">' + joiner.join(segments) + f'</{tag}>'


def blocks_html(blocks: list[dict]) -> str:
    out, in_list, in_section = [], False, False
    for block in blocks:
        kind, text = block['kind'], block['text']
        if kind != 'li' and in_list:
            out.append('</ul>')
            in_list = False
        if kind in {'h2', 'pagebreak'} and in_section:
            out.append('</section>')
            in_section = False
        if kind == 'pagebreak':
            out.append('<div class="career-page-break" data-career-break="true" aria-hidden="true"></div>')
        elif kind == 'contact':
            out.append(contacts(text))
        elif kind in {'meta', 'subtitle'} and ' | ' in text:
            out.append(fields('p', text, f'career-{kind}', links=False))
        elif kind in {'p', 'h3'} and ' | ' in text:
            out.append(fields(kind, text))
        elif kind == 'meta':
            out.append(f'<p class="career-meta">{escape(text)}</p>')
        elif kind == 'subtitle':
            out.append(f'<p class="career-subtitle">{escape(text)}</p>')
        elif kind == 'li':
            if not in_list:
                out.append('<ul class="career-bullets">')
                in_list = True
            out.append('<li>' + linkify(text) + '</li>')
        else:
            if kind == 'h2':
                out.append('<section>')
                in_section = True
            out.append(f'<{kind}>' + linkify(text) + f'</{kind}>')
    if in_list:
        out.append('</ul>')
    if in_section:
        out.append('</section>')
    return '\n'.join(out)


def plain(blocks: list[dict], markdown: bool = False) -> str:
    lines = []
    for block in blocks:
        kind, text = block['kind'], block['text']
        if kind == 'pagebreak':
            continue
        prefix = '- ' if kind == 'li' else ''
        if markdown and kind in {'h1', 'h2', 'h3'}:
            prefix = '#' * int(kind[1]) + ' '
        lines += [prefix + text, '']
    return '\n'.join(lines).rstrip() + '\n'


def downloads(doc: dict, include_html: bool = True) -> str:
    links = []
    if include_html:
        links.append(f'<a href="{doc["route"]}">' + ('Read the CV' if doc['route'] == 'cv.html' else 'Read resume') + '</a>')
    for suffix, label in [('pdf', 'PDF'), ('docx', 'DOCX'), ('txt', 'Plain text'), ('md', 'Markdown')]:
        links.append(f'<a href="career/{doc["stem"]}.{suffix}" download>{label}</a>')
    return '<div class="career-downloads" aria-label="' + escape(doc['title'], quote=True) + ' formats">' + ''.join(links) + '</div>'


def shell(route: str, title: str, description: str, content: str, *, hire: bool = False) -> str:
    switch = ''.join(f'<a href="{p}"' + (' aria-current="page"' if route == p else '') + f'>{label}</a>' for p, label in [('hire.html','Hire'), ('resume.html','Resume'), ('portfolio.html','Portfolio'), ('cv.html','Full CV')])
    # The hiring page and the resume router add the art family (the pillar plate and the
    # resume cover); the hiring page also adds its own poster layout, after the shared
    # career sheet so hire.css can refine it.
    art_css = ('<link rel="stylesheet" href="system/art.css?v=20260925-human-notebook">\n'
               if route in ('hire.html', 'resume.html') else '')
    hire_css = art_css + ('<link rel="stylesheet" href="system/hire.css?v=20260925-void-plates">\n' if hire else '')
    body = '<body class="doc" data-route-art="off">' if hire else '<body class="doc">'
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{escape(title)}</title>
<meta name="description" content="{escape(description, quote=True)}">
<link rel="canonical" href="https://harperz9.github.io/{route}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Zain Dana Harper">
<meta property="og:title" content="{escape(title, quote=True)}">
<meta property="og:description" content="{escape(description, quote=True)}">
<meta property="og:url" content="https://harperz9.github.io/{route}">
<meta property="og:image" content="https://harperz9.github.io/img/og/profile.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{escape(title, quote=True)}">
<meta name="twitter:description" content="{escape(description, quote=True)}">
<meta name="twitter:image" content="https://harperz9.github.io/img/og/profile.png">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="system/doc.css?v=20260907-reading-completion">
<link rel="stylesheet" href="system/career.css?v=20260925-void-plates">
{hire_css}</head>
{body}
<a class="skip-link" href="#main">Skip to content</a>
<div id="site-nav" class="site-nav"></div>
<noscript><nav class="site-nav" aria-label="Primary"><a href="index.html">Home</a> <a href="hire.html">Hire</a> <a href="resume.html">Resume</a> <a href="portfolio.html">Portfolio</a> <a href="cv.html">Full CV</a></nav></noscript>
<script type="module" src="system/nav.js?v=20260909-pillar-navigation"></script>
<div class="docnav"><span class="where">Career</span><span class="switch">{switch}</span></div>
<main id="main" class="career-page">
<div data-export-slot></div>
{content}
</main>
</body>
</html>
'''


def source_note(source: dict) -> str:
    dates = ''.join(f'<p><strong>{escape(key.replace("_", " ").title())}:</strong> {escape(value)}</p>' for key, value in source['date_policy'].items())
    return f'''<aside class="career-source-note">
<p>Updated <time datetime="{source['reviewed']}">{source['reviewed']}</time>. All formats share the same reviewed content.</p>
<p><a href="career/source-ledger.md">Source and date notes</a> · <a href="career/resume-source.json">Structured career source</a> · <a href="career/career-build-receipt.json">Build receipt</a></p>
<details><summary>Work-history and evidence notes</summary>{dates}<p>Descriptions of public software are not claims of customer adoption, external certification, or universal safety. Private material is excluded.</p></details>
</aside>'''


# Plates from the aperture art family, with the alt text art/aperture/covers.json records.
# The Work pillar plate sits beside the hiring page's opening copy; the resume router
# carries the contour-map cover under its heading.
COVER_ALT = json.loads((ROOT / 'art' / 'aperture' / 'covers.json').read_text(encoding='utf-8'))['alt']


def art_figure(name: str, kind: str, width: int, height: int) -> str:
    alt = escape(COVER_ALT[name], quote=True)
    return f'<figure class="art art-{kind}">' + ''.join(
        f'<img class="art-{theme}" src="art/aperture/{name}-{theme}.svg" width="{width}" height="{height}" alt="{alt}" decoding="async">'
        for theme in ('light', 'dark')
    ) + '</figure>'


PILLAR_WORK = art_figure('pillar-work', 'pillar', 1200, 900)
RESUME_COVER = art_figure('cover-resume', 'cover', 1600, 800)


def router_body(source: dict, *, hire: bool) -> str:
    docs = {doc['id']: doc for doc in source['documents']}
    contact = contacts('Seattle, Washington | zaindharper@gmail.com | harperz9.github.io')
    cls = 'hire-sheet' if hire else 'sheet doc-rail'
    intro = ('I build systems that make complex work inspectable: AI workstations, developer tools, evaluation infrastructure, and controlled-action interfaces. I also bring eleven years of arboriculture, customer service, estimating, and field coordination.' if hire else 'Choose the resume that matches the work. Each targeted resume is one page and includes experience, skills, and selected evidence, with the same content in HTML, PDF, DOCX, plain text, and Markdown. The full CV adds the wider project and research record.')
    out = [f'<article class="{cls}">', '<header class="career-mast"><h1>Zain Dana Harper</h1>' + (PILLAR_WORK if hire else ''), '<p class="career-subtitle">Systems engineering, developer tools, and practical operations.</p>', contact, f'<p>{intro}</p></header>'] + ([] if hire else [RESUME_COVER]) + ['<section id="technical-lanes"><h2>Resumes</h2><div class="career-cards">']
    cards = [
        ('support-operations-qa', 'engineering-path', 'Support, developer operations, and software quality', 'Technical support, developer operations, and QA experience: reproducible troubleshooting, accepted tests and documentation for Free Law Project, Hebbian Robotics, and Voxwire, software delivery, and customer communication.'),
        ('evaluation-python-tools', 'technical-operations-path', 'AI systems, evaluation, and Python tooling', 'Flywheel, Rowan, controlled-action interfaces, writing tools, and verification infrastructure, alongside accepted fixes in DeepEval, TOMLKit, and Datasette.'),
        ('grounds', 'public-service-field-path', 'Arboriculture, field operations, and estimating', 'Eleven years of ground-based tree-care operations, site assessment, estimates, scheduling, client education, and safety coordination. A public-operations variant is also available.'),
    ]
    for key, anchor, title, description in cards:
        doc = docs[key]
        out += [f'<div class="career-card" id="{anchor}"><span id="{key}"></span><h3>{title}</h3><p>{description}</p>', downloads(doc)]
        if key == 'grounds':
            out += ['<p class="career-variant"><a href="resume-public-operations.html">Public operations and facilities-support variant</a></p>', downloads(docs['public-operations'], include_html=False)]
        out += ['</div>']
    out += ['</div></section>', '<section><h2>Full CV and portfolio</h2><p>The full CV retains the expanded record separately from the one-page resumes. It covers AI systems, compilers, security and verification tooling, graphics, technical writing, the earlier programming trajectory, and independent research.</p>', downloads(docs['page:cv']), '<p><a href="portfolio.html">Explore the portfolio</a> · <a href="flywheel.html">Flywheel platform</a> · <a href="publications.html">Publications</a></p></section>', '<section><h2>Research and contribution record</h2><p>Eight independent research records include <a href="https://doi.org/10.5281/zenodo.21230267">EMET</a> and other DOI-indexed papers and manuscripts. These records are not peer reviewed. The <a href="portfolio.html">contribution record</a> distinguishes merged, open, and closed without merge outcomes.</p></section>', '<section><h2>Using the files</h2><p>Use the file type requested by the employer. PDF preserves the reviewed layout; DOCX supports editing and document-based submissions; plain text is useful for application fields. Review any information filled in automatically after upload.</p></section>', '<section><h2>Contact</h2><p><a href="mailto:zaindharper@gmail.com">zaindharper@gmail.com</a> · <a href="https://www.linkedin.com/in/zaindanaharper/">LinkedIn</a> · <a href="https://github.com/HarperZ9">GitHub</a></p></section>', '</article>', source_note(source)]
    return '\n'.join(out)


def render(source: dict) -> dict[str, str]:
    if source.get('schema') != 'harperz9-career-source/v2':
        raise ValueError('unsupported career source schema')
    outputs = {}
    seen = set()
    for doc in source['documents']:
        route, stem = doc['route'], doc['stem']
        if not re.fullmatch(r'(?:resume-[a-z-]+|cv)\.html', route) or not re.fullmatch(r'Zain-Dana-Harper-[A-Za-z-]+', stem) or route in seen:
            raise ValueError('invalid or duplicate career output path')
        seen.add(route)
        blocks = expand(doc['blocks'], source['groups'])
        if not blocks or blocks[0]['kind'] != 'h1':
            raise ValueError('career document must begin with a name heading')
        content = downloads(doc, False) + '\n<article class="sheet doc-rail">\n' + blocks_html(blocks) + '\n</article>\n' + source_note(source)
        if route == 'cv.html':
            content += '<p class="career-source-note">Eight independent research records are described in the <a href="publications.html">publication index</a>; these records are not peer reviewed.</p>'
        outputs[route] = shell(route, 'Zain Dana Harper | ' + doc['title'], doc['title'] + ' resume and source-matched downloads. Updated ' + source['reviewed'] + '.', content)
        outputs[f'career/{stem}.txt'] = plain(blocks)
        outputs[f'career/{stem}.md'] = plain(blocks, markdown=True)
        if route == 'cv.html':
            outputs['cv.md'] = plain(blocks, markdown=True)
    for route, hire in [('hire.html', True), ('resume.html', False)]:
        outputs[route] = shell(route, 'Zain Dana Harper | ' + ('Hire' if hire else 'Resumes'), 'Current resumes for systems engineering, developer operations, and field operations, plus a full CV.', router_body(source, hire=hire), hire=hire)
    lines = ['# Zain Dana Harper: Resumes', '', 'Updated ' + source['reviewed'] + '.', '', 'Three primary families: support/developer operations/QA; AI systems/evaluation/Python tooling; arboriculture/field operations/estimating. Each targeted resume is one page. A public-operations variant and full CV are also available.', '']
    for doc in source['documents']:
        lines += ['## ' + doc['title'], '', 'https://harperz9.github.io/' + doc['route'], '']
        lines += [f'[{suffix.upper()}](https://harperz9.github.io/career/{doc["stem"]}.{suffix})' for suffix in ('pdf', 'docx', 'txt', 'md')]
        lines += ['']
    lines += ['## Work-history and source notes', ''] + list(source['date_policy'].values()) + ['', 'Detailed source ledger: https://harperz9.github.io/career/source-ledger.md', '']
    outputs['resume.md'] = '\n'.join(lines)
    return outputs


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    source = json.loads(SOURCE.read_text(encoding='utf-8'))
    outputs = render(source)
    receipt = {
        'schema': 'harperz9-career-text-build/v1',
        'reviewed': source['reviewed'],
        'source': {'path': 'career/resume-source.json', 'sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest()},
        'renderer_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        'outputs': [{'path': path, 'sha256': hashlib.sha256(text.encode('utf-8')).hexdigest(), 'byte_length': len(text.encode('utf-8'))} for path, text in sorted(outputs.items())],
    }
    outputs['career/text-build-receipt.json'] = json.dumps(receipt, indent=2, sort_keys=True) + '\n'
    drift = []
    for relative, text in outputs.items():
        path = ROOT / relative
        payload = text.encode('utf-8')
        if args.check:
            if not path.is_file() or path.read_bytes() != payload:
                drift.append(relative)
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(payload)
    if drift:
        print('Career source drift: ' + ', '.join(drift))
        return 1
    print(('Checked' if args.check else 'Rendered') + f' {len(outputs)} career pages/text exports.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
