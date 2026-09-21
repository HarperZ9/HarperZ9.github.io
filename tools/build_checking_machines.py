"""Build the open letter's page and portable editions from its canonical Markdown.

Only the existing letter page and writing/checking-the-machines/ are written.
Run: python tools/build_checking_machines.py
Dependencies: python-docx 1.2.0, reportlab 4.4.9.
"""
from __future__ import annotations

import hashlib
import html
import io
import json
import re
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from xml.sax.saxutils import escape

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor
from reportlab import rl_config
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, PageBreak, Spacer, KeepTogether

from render_legacy_essays import render_page

ROOT = Path(__file__).resolve().parents[1]
FOLDER = ROOT / "writing/checking-the-machines"
SOURCE = FOLDER / "01.md"
OUT = FOLDER / "downloads"
TITLE = "An Open Letter on Checking the Machines"
STEM = "An-Open-Letter-on-Checking-the-Machines"
CANONICAL = "https://harperz9.github.io/checking-the-machines.html"
REVISED = "2026-09-20"
LINK = re.compile(r"\[([^\]]+)\]\((https?://[^\s)]+)\)")


def plain(value: str, urls: bool = False) -> str:
    def replace(m: re.Match[str]) -> str:
        if m[1].isdigit() and m[2].startswith(CANONICAL + "#note-"):
            return "[" + m[1] + "]"
        return m[1] + (" (" + m[2] + ")" if urls else "")
    return LINK.sub(replace, value).replace("**", "").replace("*", "")


def blocks(source: str):
    for block in source.strip().split("\n\n"):
        if block.strip() != "---":
            yield " ".join(block.splitlines())


def add_hyperlink(p, label: str, url: str):
    h = OxmlElement("w:hyperlink")
    internal = url.startswith(CANONICAL + "#note-")
    if internal:
        h.set(qn("w:anchor"), url.split("#", 1)[1])
    else:
        h.set(qn("r:id"), p.part.relate_to(url, "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink", is_external=True))
    run = OxmlElement("w:r")
    props = OxmlElement("w:rPr")
    color = OxmlElement("w:color"); color.set(qn("w:val"), "244C59"); props.append(color)
    if internal:
        sup = OxmlElement("w:vertAlign"); sup.set(qn("w:val"), "superscript"); props.append(sup)
    run.append(props)
    t = OxmlElement("w:t"); t.text = label; run.append(t)
    h.append(run); p._p.append(h)


def runs(p, text: str):
    start = 0
    for m in LINK.finditer(text):
        p.add_run(text[start:m.start()]); add_hyperlink(p, m[1], m[2]); start = m.end()
    p.add_run(text[start:])


def write_docx(source: str):
    doc = Document(); sec = doc.sections[0]
    sec.page_width = Inches(8.5); sec.page_height = Inches(11)
    sec.top_margin = sec.bottom_margin = Inches(.8)
    sec.left_margin = sec.right_margin = Inches(.9)
    sec.header_distance = sec.footer_distance = Inches(.35)
    normal = doc.styles["Normal"]
    normal.font.name = "Times New Roman"; normal.font.size = Pt(11.5)
    normal.paragraph_format.line_spacing = 1.16
    normal.paragraph_format.space_after = Pt(8)
    normal.paragraph_format.widow_control = True
    lang = OxmlElement("w:lang"); lang.set(qn("w:val"), "en-US")
    normal.element.get_or_add_rPr().append(lang)
    for name,size in (("Title",22),("Heading 1",17),("Heading 2",12)):
        st=doc.styles[name];st.font.name="Times New Roman";st.font.size=Pt(size)
        st.font.color.rgb=RGBColor(25,25,25);st.font.bold=True
        st.paragraph_format.keep_with_next=True
        st.paragraph_format.space_before=Pt(12);st.paragraph_format.space_after=Pt(8)
    # Explicit serif choices take precedence over the template's theme fonts.
    for name in ("Normal", "Title", "Heading 1", "Heading 2"):
        st = doc.styles[name]
        rfonts = st.element.get_or_add_rPr().find(qn("w:rFonts"))
        if rfonts is not None:
            for key in list(rfonts.attrib):
                if "theme" in key.lower():
                    del rfonts.attrib[key]
            rfonts.set(qn("w:eastAsia"), "Times New Roman")
            rfonts.set(qn("w:cs"), "Times New Roman")
        ppr = st.element.find(qn("w:pPr"))
        if ppr is not None:
            for border in list(ppr.findall(qn("w:pBdr"))):
                ppr.remove(border)
    props=doc.core_properties
    props.title=TITLE;props.author="Zain Dana Harper";props.subject="Evidence, authority, and the people affected by AI-assisted work"
    props.comments="Author-directed; AI-assisted. Research cutoff September 20, 2026. Not peer reviewed."
    props.created=props.modified=datetime(2026,9,20,tzinfo=timezone.utc)
    foot=sec.footer.paragraphs[0];foot.alignment=WD_ALIGN_PARAGRAPH.RIGHT
    run=foot.add_run("Zain Dana Harper | ");run.font.size=Pt(9)
    field=OxmlElement("w:fldSimple");field.set(qn("w:instr"),"PAGE");foot._p.append(field)
    bid=1
    for b in blocks(source):
        if b.startswith("# "):
            doc.add_paragraph(b[2:],"Title")
            p=doc.add_paragraph("Zain Dana Harper\nFirst published September 19, 2026 | Revised September 20, 2026")
            p.paragraph_format.space_after=Pt(18)
            for r in p.runs:r.font.size=Pt(10)
        elif b.startswith("## "):
            p=doc.add_paragraph(b[3:],"Heading 1")
            if b == "## Notes and sources":p.paragraph_format.page_break_before=True
        elif b.startswith("### "):
            p=doc.add_paragraph(b[4:],"Heading 2")
            mark=OxmlElement("w:bookmarkStart");mark.set(qn("w:id"),str(bid));mark.set(qn("w:name"),b[4:].lower().replace(" ","-"))
            end=OxmlElement("w:bookmarkEnd");end.set(qn("w:id"),str(bid))
            p._p.insert(0,mark);p._p.append(end);bid+=1
        else:
            p=doc.add_paragraph();runs(p,b)
            if b == "Zain Dana Harper":
                p.paragraph_format.keep_with_next=True
                for r in p.runs:r.bold=True
    data=io.BytesIO();doc.save(data)
    # Fix archive timestamps to make the portable document reproducible.
    with zipfile.ZipFile(data) as inp,zipfile.ZipFile(OUT/f"{STEM}.docx","w",zipfile.ZIP_DEFLATED) as out:
        for name in sorted(inp.namelist()):
            info=zipfile.ZipInfo(name,(2026,9,20,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED
            out.writestr(info,inp.read(name))


def pdf_inline(value: str) -> str:
    result=[];start=0
    for m in LINK.finditer(value):
        result.append(escape(value[start:m.start()]))
        target=m[2]
        if target.startswith(CANONICAL+"#note-"):
            result.append(f'<super><link href="#{target.split("#")[1]}" color="#244C59">{escape(m[1])}</link></super>')
        else:
            result.append(f'<link href="{escape(target)}" color="#244C59">{escape(m[1])}</link>')
        start=m.end()
    result.append(escape(value[start:]))
    return ''.join(result)


def write_pdf(source: str):
    rl_config.invariant=1
    styles={
      "body":ParagraphStyle("body",fontName="Times-Roman",fontSize=11.5,leading=15.6,spaceAfter=8,alignment=TA_LEFT,allowWidows=0,allowOrphans=0),
      "title":ParagraphStyle("title",fontName="Times-Bold",fontSize=22,leading=25,spaceAfter=12),
      "meta":ParagraphStyle("meta",fontName="Times-Roman",fontSize=10,leading=13,spaceAfter=18),
      "h1":ParagraphStyle("h1",fontName="Times-Bold",fontSize=17,leading=20,spaceBefore=12,spaceAfter=10,keepWithNext=True),
      "h2":ParagraphStyle("h2",fontName="Times-Bold",fontSize=12,leading=15,spaceBefore=10,spaceAfter=6,keepWithNext=True),
    }
    flow=[];in_notes=False
    for b in blocks(source):
        if b.startswith("# "):
            flow.extend([Paragraph(escape(b[2:]),styles["title"]),Paragraph("Zain Dana Harper<br/>First published September 19, 2026 | Revised September 20, 2026",styles["meta"])])
        elif b.startswith("## "):
            if b == "## Notes and sources":flow.append(PageBreak());in_notes=True
            flow.append(Paragraph(escape(b[3:]),styles["h1"]))
        elif b.startswith("### "):
            name=b[4:].lower().replace(' ','-')
            flow.append(Paragraph(f'<a name="{name}"/>'+escape(b[4:]),styles["h2"]))
        elif b=="Zain Dana Harper":
            flow.append(KeepTogether([Paragraph("<b>Zain Dana Harper</b>",styles["body"]),Paragraph("Zentropy Labs",styles["body"])]))
        elif b=="Zentropy Labs":continue
        else:flow.append(Paragraph(pdf_inline(b),styles["body"]))
    def footer(canvas,doc):
        canvas.saveState();canvas.setFont("Times-Roman",9)
        canvas.drawRightString(8.5*72-.9*72,.4*72,f"Zain Dana Harper | {doc.page}")
        canvas.restoreState()
    doc=SimpleDocTemplate(str(OUT/f"{STEM}.pdf"),pagesize=(612,792),leftMargin=64.8,rightMargin=64.8,topMargin=57.6,bottomMargin=57.6,title=TITLE,author="Zain Dana Harper",subject="Author-directed, AI-assisted open letter. Revised September 20, 2026.")
    doc.build(flow,onFirstPage=footer,onLaterPages=footer)


def write_page():
    path=ROOT/"checking-the-machines.html"
    s=path.read_text(encoding="utf-8")
    s=re.sub(r'<meta name="author" content="[^"]*">','<meta name="author" content="Zain Dana Harper; AI-assisted, author-directed">',s)
    header='''<header class="article-head">
<p class="role">Open letter · Verification and accountability</p><h1>An Open Letter on Checking the Machines</h1>
<p class="lead">Evidence we can examine. Authority we can question. A life to return to.</p>
<p class="article-meta">Zain Dana Harper · Zentropy Labs</p>
<p class="article-meta"><time datetime="2026-09-19">September 19, 2026</time> <span class="sep">/</span> Revised <time datetime="2026-09-20">September 20, 2026</time> <span class="sep">/</span> <span data-word-count></span> source words including notes and links <span class="sep">/</span> Author-directed, AI-assisted</p>
<nav class="letter-downloads" aria-label="Download this letter"><a href="writing/checking-the-machines/downloads/An-Open-Letter-on-Checking-the-Machines.pdf">PDF</a><a href="writing/checking-the-machines/downloads/An-Open-Letter-on-Checking-the-Machines.docx">Word</a><a href="writing/checking-the-machines/downloads/An-Open-Letter-on-Checking-the-Machines.txt">Plain text</a><a href="writing/checking-the-machines/01.md">Markdown</a><a href="#notes-and-sources">Sources</a></nav>
</header>'''
    # Avoid a promotional triad: the heading states the central question once.
    header=header.replace('Evidence we can examine. Authority we can question. A life to return to.','What would let another person examine our work and question what follows from it?')
    s,n=re.subn(r'<header class="article-head">.*?</header>',lambda _:header,s,count=1,flags=re.S)
    if n!=1:raise ValueError("Expected exactly one letter header")
    css='''  /* Letter edition controls: deliberately scoped to this page. */
  .letter-page .letter-downloads{display:flex;flex-wrap:wrap;gap:.65rem 1.1rem;margin:1.2rem 0 1.7rem;font-size:.95rem}
  .letter-page .letter-downloads a{color:var(--teal-soft);text-underline-offset:.2em}
  .letter-page .article-body a[href*="#note-"]{font-size:.7em;vertical-align:super;line-height:0;padding:.25em;text-decoration:none;border:0}
  .letter-page .article-body h2,.letter-page .article-body h3{scroll-margin-top:1rem}
  .letter-page .article-body a{overflow-wrap:anywhere}
  @media print{.letter-page .letter-downloads{display:none!important}}
'''
    if '/* Letter edition controls:' not in s:s=s.replace('</style>',css+'</style>',1)
    s=re.sub(r'<footer class="article-footer">.*?</footer>','<footer class="article-footer">By Zain Dana Harper. Author-directed and AI-assisted. Sources, revision history and assistance details appear above. This letter has not undergone peer review.</footer>',s,count=1,flags=re.S)
    path.write_text(s,encoding="utf-8")
    path.write_bytes(render_page(path,(Path("writing/checking-the-machines/01.md"),),"essay"))


def write_source_notes(source: str):
    notes = []
    for match in re.finditer(r"^### Note (\d+)\n\n(.*?)(?=\n### |\n## |\Z)", source, re.M | re.S):
        number, text = match.groups()
        evidence = [paragraph for paragraph in source.split("\n\n") if f"#note-{number})" in paragraph]
        notes.append({"id": f"note-{number}", "supports": [plain(p) for p in evidence],
                      "sources": [{"title": m[1], "url": m[2]} for m in LINK.finditer(text)],
                      "inspection_and_limits": plain(text.strip())})
    ledger = {
        "schema": "essay-source-notes/v1", "title": TITLE, "slug": "checking-the-machines",
        "date": "2026-09-19", "revised": REVISED, "evidence_cutoff": REVISED,
        "kind": "signed open letter", "status": "author-directed revision authorized for publication; proposed trial not run",
        "signature": "Zain Dana Harper / Zentropy Labs", "claims": notes,
        "unpinned_references": [],
        "source_sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        "ai_assistance": {"state": "AI-assisted, author-directed", "detail": "ChatGPT assisted with this revision's research, drafting and publication preparation. Earlier drafting used Claude. No human-only authorship or peer review is claimed."},
        "author_approval": {"state": "publication authorized", "basis": "The author requested publication on the existing letter page and further revision of voice and pacing on September 20, 2026 (Seattle local date).", "does_not_establish": "Independent factual certification, line-by-line author review of the generated revision, or completion of the proposed pilot."},
        "original_revision": "87c320c881392b753c09b3fda305dd9500ca40d6",
        "articulate_revision": "15d4fc206755772f79e54c7e95e029b580be772d"
    }
    (FOLDER / "source-notes.json").write_text(json.dumps(ledger, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main():
    source=SOURCE.read_text(encoding="utf-8")
    OUT.mkdir(parents=True,exist_ok=True)
    txt="\n\n".join(plain(re.sub(r'^#{1,3} ', '',b),True) for b in blocks(source))+"\n"
    (OUT/f"{STEM}.txt").write_text(txt,encoding="utf-8")
    write_docx(source);write_pdf(source);write_page();write_source_notes(source)
    files=[ROOT/"checking-the-machines.html",SOURCE,FOLDER/"source-notes.json",FOLDER/"reading-and-revision-note.md",FOLDER/"pilot-protocol.md",FOLDER/"articulate-receipt.json",*sorted(OUT.iterdir())]
    record={"schema":"checking-machines-build/v1","revised":REVISED,"source_sha256":hashlib.sha256(SOURCE.read_bytes()).hexdigest(),"outputs":[{"path":p.relative_to(ROOT).as_posix(),"sha256":hashlib.sha256(p.read_bytes()).hexdigest()} for p in files]}
    (FOLDER/"build.json").write_text(json.dumps(record,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(record,indent=2))

if __name__=="__main__":main()
