// export.js, take any page on this site away with you.
//
// Every page offers its text as Markdown, plain text, Word, or print/PDF. The
// conversion happens here in the browser, reading the page you are actually
// looking at. That is the point: a pre-generated export is a second copy that
// starts drifting from the page the moment either one is edited, and on a
// static host there is nothing to regenerate it. Reading the live document
// means the export cannot be out of date and a page added next year needs no
// extra work.
//
// PDF goes through the browser's own print pipeline rather than a PDF writer
// built here. system/print.css gives every page a print-grade contract, and
// the browser's typesetting beats anything a few hundred lines of JavaScript
// would produce.
//
// No dependencies. The .docx is a ZIP written by hand with stored (uncompressed)
// entries, which Word opens without complaint.

/* ───────────────────────────── what to read ───────────────────────────── */

// Chrome, controls, and live instruments. A canvas is skipped because its
// pixels are not text; the figcaption beside it is kept, so a reader of the
// export still learns what the figure was.
const SKIP = [
  "script", "style", "noscript", "template", "canvas", "svg", "video", "audio",
  "iframe", "object", "form", "button", "input", "select", "textarea", "dialog",
  ".site-nav", ".docnav", ".skip-link", ".export-bar", ".export-menu",
  ".sn-more", ".route-art", ".totop", ".controls", ".visual-controls",
  ".visual-nav", ".re-panel", ".dk-panel", ".wv-panel", ".tp-dfwv", ".tp-rotv",
  "[data-export='skip']",
].join(",");

function isSkipped(el) {
  if (el.nodeType !== 1) return false;
  if (el.hidden) return true;
  if (el.getAttribute("aria-hidden") === "true") return true;
  if (el.matches(SKIP)) return true;
  // An element hidden by CSS is not part of the document a reader sees. This
  // runs on a live page, so getComputedStyle is honest about it.
  const cs = getComputedStyle(el);
  return cs.display === "none" || cs.visibility === "hidden";
}

function contentRoot(doc) {
  return doc.querySelector("main#main") || doc.querySelector("main")
    || doc.querySelector("article") || doc.body;
}

/* ──────────────────────── page into a block model ─────────────────────── */

const BLOCK_TAGS = new Set([
  "P", "H1", "H2", "H3", "H4", "H5", "H6", "UL", "OL", "DL", "PRE",
  "BLOCKQUOTE", "TABLE", "HR", "FIGCAPTION", "LI", "DT", "DD",
]);

function inlineOf(node, out = []) {
  for (const child of node.childNodes) {
    if (child.nodeType === 3) {
      const v = child.nodeValue.replace(/\s+/g, " ");
      if (v) out.push({ t: "text", v });
      continue;
    }
    if (child.nodeType !== 1 || isSkipped(child)) continue;
    const tag = child.tagName;
    if (tag === "BR") { out.push({ t: "br" }); continue; }
    if (tag === "CODE" && child.closest("pre") === null) {
      out.push({ t: "code", v: child.textContent.replace(/\s+/g, " ").trim() });
      continue;
    }
    if (tag === "A" && child.getAttribute("href")) {
      const c = inlineOf(child, []);
      if (c.length) out.push({ t: "link", href: child.href, c });
      continue;
    }
    if (tag === "STRONG" || tag === "B") { out.push({ t: "strong", c: inlineOf(child, []) }); continue; }
    if (tag === "EM" || tag === "I") { out.push({ t: "em", c: inlineOf(child, []) }); continue; }

    // A run of fields laid out with flex or grid has its separators drawn by
    // CSS, not written in the markup: the contact line and the plate folio are
    // both a paragraph of sibling spans with a border between them. Extracted
    // as plain text they run together into one unreadable string. Anything the
    // page is not laying out inline gets a separator, which is a property of
    // how it reads rather than a guess about this site's class names.
    const display = getComputedStyle(child).display;
    if (display && display.indexOf("inline") === -1 && out.length) {
      const prev = out[out.length - 1];
      if (!(prev.t === "sep" || prev.t === "br")) out.push({ t: "sep" });
    }
    inlineOf(child, out);
  }
  return out;
}

const isBlank = (p) => p.t === "text" && !p.v.trim();

function trimInline(parts) {
  let out = parts.slice();

  // The separator carries its own spaces, and the markup around it usually
  // has whitespace of its own from indentation, so a field list came out as
  // "Washington  ·  Remote" with a stray separator at the front. Drop the
  // blank text on either side of every separator, then trim the ends. Both
  // loops run to a fixed point: one pass leaves a blank behind the separator
  // it just removed.
  const cleaned = [];
  for (const p of out) {
    if (p.t === "sep") {
      while (cleaned.length && isBlank(cleaned[cleaned.length - 1])) cleaned.pop();
      if (!cleaned.length || cleaned[cleaned.length - 1].t === "sep") continue;
      cleaned.push(p);
      continue;
    }
    if (isBlank(p) && cleaned.length && cleaned[cleaned.length - 1].t === "sep") continue;
    cleaned.push(p);
  }
  out = cleaned;

  while (out.length && (out[0].t === "sep" || isBlank(out[0]))) out.shift();
  while (out.length && (out[out.length - 1].t === "sep" || isBlank(out[out.length - 1]))) out.pop();
  if (out.length && out[0].t === "text") out[0] = { t: "text", v: out[0].v.replace(/^\s+/, "") };
  const last = out.length - 1;
  if (last >= 0 && out[last].t === "text") out[last] = { t: "text", v: out[last].v.replace(/\s+$/, "") };
  return out;
}

function inlineIsEmpty(parts) {
  return !parts.some((p) => (p.t === "text" && p.v.trim()) || p.t === "code" || p.t === "link"
    || ((p.t === "strong" || p.t === "em") && !inlineIsEmpty(p.c)));
}

function listItems(listEl) {
  const items = [];
  for (const li of listEl.children) {
    if (li.tagName !== "LI" || isSkipped(li)) continue;
    const nested = [...li.children].filter((c) => (c.tagName === "UL" || c.tagName === "OL") && !isSkipped(c));
    const clone = li.cloneNode(true);
    [...clone.children].forEach((c) => { if (c.tagName === "UL" || c.tagName === "OL") c.remove(); });
    items.push({
      inline: trimInline(inlineOf(clone, [])),
      lists: nested.map((n) => ({ ordered: n.tagName === "OL", items: listItems(n) })),
    });
  }
  return items;
}

function tableOf(el) {
  const rows = [...el.querySelectorAll("tr")].filter((r) => !isSkipped(r));
  if (!rows.length) return null;
  const cells = (r) => [...r.children]
    .filter((c) => (c.tagName === "TD" || c.tagName === "TH") && !isSkipped(c))
    .map((c) => trimInline(inlineOf(c, [])));
  const headRow = rows.find((r) => r.querySelector("th"));
  const head = headRow ? cells(headRow) : [];
  const body = rows.filter((r) => r !== headRow).map(cells).filter((r) => r.length);
  return { head, rows: body };
}

export function readPage(doc = document) {
  const root = contentRoot(doc);
  const blocks = [];
  const seen = new Set();

  const walk = (el) => {
    for (const child of el.children) {
      if (isSkipped(child) || seen.has(child)) continue;
      const tag = child.tagName;

      if (/^H[1-6]$/.test(tag)) {
        const inline = trimInline(inlineOf(child, []));
        if (!inlineIsEmpty(inline)) blocks.push({ type: "heading", level: +tag[1], inline });
        seen.add(child); continue;
      }
      if (tag === "P" || tag === "FIGCAPTION") {
        const inline = trimInline(inlineOf(child, []));
        if (!inlineIsEmpty(inline)) {
          blocks.push({ type: tag === "P" ? "para" : "caption", inline });
        }
        seen.add(child); continue;
      }
      if (tag === "UL" || tag === "OL") {
        const items = listItems(child);
        if (items.length) blocks.push({ type: "list", ordered: tag === "OL", items });
        seen.add(child); continue;
      }
      if (tag === "DL") {
        const defs = [];
        let term = null;
        for (const kid of child.children) {
          if (isSkipped(kid)) continue;
          if (kid.tagName === "DT") term = trimInline(inlineOf(kid, []));
          else if (kid.tagName === "DD") defs.push({ term: term || [], def: trimInline(inlineOf(kid, [])) });
        }
        if (defs.length) blocks.push({ type: "defs", items: defs });
        seen.add(child); continue;
      }
      if (tag === "PRE") {
        const text = child.textContent.replace(/\s+$/, "");
        if (text.trim()) blocks.push({ type: "code", text });
        seen.add(child); continue;
      }
      if (tag === "BLOCKQUOTE") {
        const inline = trimInline(inlineOf(child, []));
        if (!inlineIsEmpty(inline)) blocks.push({ type: "quote", inline });
        seen.add(child); continue;
      }
      if (tag === "TABLE") {
        const t = tableOf(child);
        if (t) blocks.push({ type: "table", ...t });
        seen.add(child); continue;
      }
      if (tag === "HR") { blocks.push({ type: "rule" }); seen.add(child); continue; }

      walk(child);
    }
  };
  walk(root);

  const h1 = doc.querySelector(".mast h1, h1");
  const title = (h1 && h1.textContent.trim()) || doc.title || "Untitled";

  // Every export writes the title as its own heading, so the page's own h1
  // would otherwise appear twice in a row. Drop the leading one when it says
  // the same thing.
  // Compare on normalised whitespace. The title comes from raw textContent,
  // which keeps the newlines and indentation of a heading that spans lines,
  // while the block model has already collapsed them, so an exact match missed
  // and the heading printed twice.
  const norm = (s) => s.replace(/\s+/g, " ").trim();
  const flat = (b) => norm(b.inline.map(function f(p) {
    return p.t === "text" ? p.v : (p.c ? p.c.map(f).join("") : (p.v || ""));
  }).join(""));
  // Scan the opening blocks rather than only the first: a page can carry a
  // kicker or a metadata line above its h1, which pushed the heading out of
  // position zero and left the title printed twice.
  for (let i = 0; i < Math.min(4, blocks.length); i++) {
    const b = blocks[i];
    if (b.type === "heading" && b.level === 1 && flat(b) === norm(title)) {
      blocks.splice(i, 1);
      break;
    }
  }

  return {
    title,
    docTitle: doc.title || "",
    url: doc.location ? doc.location.href.split("#")[0] : "",
    blocks,
  };
}

/* ──────────────────────────── Markdown ────────────────────────────────── */

const mdEscape = (s) => s.replace(/([\\`*_[\]<>])/g, "\\$1");

const SEP = " · ";

function mdInline(parts) {
  return parts.map((p) => {
    if (p.t === "text") return mdEscape(p.v);
    if (p.t === "sep") return SEP;
    if (p.t === "br") return "  \n";
    if (p.t === "code") return "`" + p.v.replace(/`/g, "``") + "`";
    if (p.t === "strong") { const i = mdInline(p.c).trim(); return i ? "**" + i + "**" : ""; }
    if (p.t === "em") { const i = mdInline(p.c).trim(); return i ? "*" + i + "*" : ""; }
    if (p.t === "link") {
      const label = mdInline(p.c).trim();
      if (!label) return "";
      // a link whose text is already its destination reads better bare
      if (label.replace(/\\/g, "") === p.href.replace(/^https?:\/\//, "").replace(/\/$/, "")) {
        return "<" + p.href + ">";
      }
      return "[" + label + "](" + p.href + ")";
    }
    return "";
  }).join("");
}

function mdList(list, depth = 0) {
  const pad = "  ".repeat(depth);
  const lines = [];
  list.items.forEach((item, i) => {
    const marker = list.ordered ? (i + 1) + ". " : "- ";
    lines.push(pad + marker + mdInline(item.inline).trim());
    item.lists.forEach((n) => lines.push(mdList(n, depth + 1)));
  });
  return lines.join("\n");
}

export function toMarkdown(page, opts = {}) {
  const out = [];
  if (opts.frontMatter !== false) {
    out.push("---");
    out.push("title: " + JSON.stringify(page.title));
    if (page.url) out.push("source: " + page.url);
    out.push("retrieved: " + new Date().toISOString().slice(0, 10));
    out.push("---", "");
  }
  for (const b of page.blocks) {
    if (b.type === "heading") out.push("#".repeat(b.level) + " " + mdInline(b.inline).trim(), "");
    else if (b.type === "para") out.push(mdInline(b.inline).trim(), "");
    else if (b.type === "caption") out.push("*" + mdInline(b.inline).trim() + "*", "");
    else if (b.type === "list") out.push(mdList(b), "");
    else if (b.type === "quote") out.push("> " + mdInline(b.inline).trim(), "");
    else if (b.type === "code") out.push("```", b.text, "```", "");
    else if (b.type === "rule") out.push("---", "");
    else if (b.type === "defs") {
      for (const d of b.items) {
        out.push("**" + mdInline(d.term).trim() + "**  ");
        out.push(mdInline(d.def).trim(), "");
      }
    } else if (b.type === "table") {
      const head = b.head.length ? b.head : (b.rows[0] || []).map(() => []);
      const width = Math.max(head.length, ...b.rows.map((r) => r.length), 1);
      const cell = (c) => mdInline(c || []).trim().replace(/\|/g, "\\|") || " ";
      const pad = (r) => Array.from({ length: width }, (_, i) => cell(r[i]));
      out.push("| " + pad(head).join(" | ") + " |");
      out.push("|" + " --- |".repeat(width));
      for (const r of b.rows) out.push("| " + pad(r).join(" | ") + " |");
      out.push("");
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

/* ───────────────────────────── plain text ─────────────────────────────── */

function txtInline(parts) {
  return parts.map((p) => {
    if (p.t === "text") return p.v;
    if (p.t === "sep") return SEP;
    if (p.t === "br") return "\n";
    if (p.t === "code") return p.v;
    if (p.t === "strong" || p.t === "em") return txtInline(p.c);
    if (p.t === "link") {
      const label = txtInline(p.c).trim();
      const bare = p.href.replace(/^https?:\/\//, "").replace(/\/$/, "");
      return label === bare ? p.href : label + " (" + p.href + ")";
    }
    return "";
  }).join("");
}

function wrap(text, width = 78, indent = "") {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = indent;
  for (const w of words) {
    if (line.trim() && (line + " " + w).length > width) { lines.push(line); line = indent + w; }
    else line = line.trim() ? line + " " + w : indent + w;
  }
  if (line.trim()) lines.push(line);
  return lines.join("\n");
}

function txtList(list, depth = 0) {
  const lines = [];
  list.items.forEach((item, i) => {
    const pad = "  ".repeat(depth);
    const marker = list.ordered ? (i + 1) + ". " : "- ";
    lines.push(wrap(txtInline(item.inline).trim(), 78, pad + " ".repeat(marker.length))
      .replace(pad + " ".repeat(marker.length), pad + marker));
    item.lists.forEach((n) => lines.push(txtList(n, depth + 1)));
  });
  return lines.join("\n");
}

export function toText(page) {
  const out = [];
  out.push(page.title);
  out.push("=".repeat(Math.min(page.title.length, 78)));
  if (page.url) out.push(page.url);
  out.push("Retrieved " + new Date().toISOString().slice(0, 10), "");

  for (const b of page.blocks) {
    if (b.type === "heading") {
      const t = txtInline(b.inline).trim();
      out.push("", t, (b.level <= 2 ? "=" : "-").repeat(Math.min(t.length, 78)), "");
    } else if (b.type === "para") out.push(wrap(txtInline(b.inline).trim()), "");
    else if (b.type === "caption") out.push(wrap("[" + txtInline(b.inline).trim() + "]"), "");
    else if (b.type === "list") out.push(txtList(b), "");
    else if (b.type === "quote") out.push(wrap(txtInline(b.inline).trim(), 74, "    "), "");
    else if (b.type === "code") out.push(b.text.split("\n").map((l) => "    " + l).join("\n"), "");
    else if (b.type === "rule") out.push("-".repeat(78), "");
    else if (b.type === "defs") {
      for (const d of b.items) {
        out.push(txtInline(d.term).trim() + ":");
        out.push(wrap(txtInline(d.def).trim(), 74, "    "), "");
      }
    } else if (b.type === "table") {
      const rows = [b.head, ...b.rows].filter((r) => r && r.length);
      const grid = rows.map((r) => r.map((c) => txtInline(c || []).trim()));
      const width = Math.max(...grid.map((r) => r.length));
      const w = Array.from({ length: width }, (_, i) =>
        Math.min(34, Math.max(...grid.map((r) => (r[i] || "").length), 3)));
      grid.forEach((r, ri) => {
        out.push(Array.from({ length: width }, (_, i) => (r[i] || "").padEnd(w[i]).slice(0, w[i])).join("  "));
        if (ri === 0 && b.head.length) out.push(w.map((n) => "-".repeat(n)).join("  "));
      });
      out.push("");
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

/* ────────────────────────── ZIP, written by hand ──────────────────────── */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// Stored entries only: no DEFLATE implementation, and a .docx of this size
// gains nothing from compression that is worth several hundred lines of code.
// Word, LibreOffice, and Pages all open a stored-only archive.
function zip(files) {
  const enc = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;

  const u16 = (n) => [n & 0xFF, (n >>> 8) & 0xFF];
  const u32 = (n) => [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF];

  for (const { name, text } of files) {
    const nameBytes = enc.encode(name);
    const data = enc.encode(text);
    const sum = crc32(data);
    const local = [
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0),                    // time, date: fixed, not the clock
      ...u32(sum), ...u32(data.length), ...u32(data.length),
      ...u16(nameBytes.length), ...u16(0),
    ];
    parts.push(new Uint8Array(local), nameBytes, data);
    central.push({ name: nameBytes, sum, size: data.length, offset });
    offset += local.length + nameBytes.length + data.length;
  }

  const dir = [];
  for (const e of central) {
    dir.push(...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0), ...u32(e.sum), ...u32(e.size), ...u32(e.size),
      ...u16(e.name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(0), ...u32(e.offset));
    dir.push(...e.name);
  }
  const dirBytes = new Uint8Array(dir);
  const end = new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0),
    ...u16(central.length), ...u16(central.length),
    ...u32(dirBytes.length), ...u32(offset), ...u16(0),
  ]);

  const total = parts.reduce((n, p) => n + p.length, 0) + dirBytes.length + end.length;
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  out.set(dirBytes, at); at += dirBytes.length;
  out.set(end, at);
  return out;
}

/* ─────────────────────────────── .docx ────────────────────────────────── */

const xmlEscape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function runs(parts, inherited = {}) {
  const out = [];
  const emit = (text, fmt) => {
    if (!text) return;
    const props = [];
    if (fmt.b) props.push("<w:b/>");
    if (fmt.i) props.push("<w:i/>");
    if (fmt.code) props.push('<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="19"/>');
    if (fmt.link) props.push('<w:color w:val="1B3FB8"/><w:u w:val="single"/>');
    const rPr = props.length ? "<w:rPr>" + props.join("") + "</w:rPr>" : "";
    out.push("<w:r>" + rPr + '<w:t xml:space="preserve">' + xmlEscape(text) + "</w:t></w:r>");
  };
  for (const p of parts) {
    if (p.t === "text") emit(p.v, inherited);
    else if (p.t === "sep") emit(" · ", inherited);
    else if (p.t === "code") emit(p.v, { ...inherited, code: true });
    else if (p.t === "br") out.push("<w:r><w:br/></w:r>");
    else if (p.t === "strong") out.push(runs(p.c, { ...inherited, b: true }));
    else if (p.t === "em") out.push(runs(p.c, { ...inherited, i: true }));
    else if (p.t === "link") {
      out.push(runs(p.c, { ...inherited, link: true }));
      const label = p.c.map((x) => (x.t === "text" ? x.v : "")).join("").trim();
      const bare = p.href.replace(/^https?:\/\//, "").replace(/\/$/, "");
      if (label && label !== bare) emit(" (" + p.href + ")", { ...inherited, code: true });
    }
  }
  return out.join("");
}

function para(content, style, extra = "") {
  const pPr = (style ? '<w:pStyle w:val="' + style + '"/>' : "") + extra;
  return "<w:p>" + (pPr ? "<w:pPr>" + pPr + "</w:pPr>" : "") + content + "</w:p>";
}

function docxBody(page) {
  const out = [];
  out.push(para(runs([{ t: "text", v: page.title }]), "Title"));
  if (page.url) out.push(para(runs([{ t: "text", v: page.url }]), "Subtle"));
  out.push(para(runs([{ t: "text", v: "Retrieved " + new Date().toISOString().slice(0, 10) }]), "Subtle"));

  const listPara = (item, depth, ordered, index) => {
    const marker = ordered ? index + 1 + ". " : "· ";
    const indent = '<w:ind w:left="' + (360 + depth * 320) + '" w:hanging="240"/>';
    return para(runs([{ t: "text", v: marker }, ...item.inline]), "ListParagraph", indent);
  };
  const walkList = (list, depth) => {
    list.items.forEach((item, i) => {
      out.push(listPara(item, depth, list.ordered, i));
      item.lists.forEach((n) => walkList(n, depth + 1));
    });
  };

  for (const b of page.blocks) {
    if (b.type === "heading") out.push(para(runs(b.inline), "Heading" + Math.min(b.level, 4)));
    else if (b.type === "para") out.push(para(runs(b.inline)));
    else if (b.type === "caption") out.push(para(runs(b.inline), "Caption"));
    else if (b.type === "list") walkList(b, 0);
    else if (b.type === "quote") out.push(para(runs(b.inline), "Quote"));
    else if (b.type === "code") {
      for (const line of b.text.split("\n")) {
        out.push(para(runs([{ t: "code", v: line || " " }]), "Code"));
      }
    } else if (b.type === "rule") out.push(para("", null, '<w:pBdr><w:bottom w:val="single" w:sz="6" w:color="999999"/></w:pBdr>'));
    else if (b.type === "defs") {
      for (const d of b.items) {
        out.push(para(runs([{ t: "strong", c: d.term }])));
        out.push(para(runs(d.def), null, '<w:ind w:left="360"/>'));
      }
    } else if (b.type === "table") {
      const rows = [];
      const width = Math.max(b.head.length, ...b.rows.map((r) => r.length), 1);
      const cellW = Math.floor(9360 / width);
      const row = (cells, header) => {
        const tcs = Array.from({ length: width }, (_, i) =>
          "<w:tc><w:tcPr><w:tcW w:w=\"" + cellW + "\" w:type=\"dxa\"/></w:tcPr>"
          + para(runs(header ? [{ t: "strong", c: cells[i] || [] }] : (cells[i] || [])), "TableText")
          + "</w:tc>");
        return "<w:tr>" + tcs.join("") + "</w:tr>";
      };
      if (b.head.length) rows.push(row(b.head, true));
      for (const r of b.rows) rows.push(row(r, false));
      // No w:tblStyle here: naming a style the styles part does not define is
      // the kind of dangling reference Word forgives and stricter readers do
      // not. The borders below are stated outright instead. w:tblGrid is
      // required by the schema, not optional; without it a table opens in Word
      // and throws in a conforming reader.
      const grid = "<w:tblGrid>"
        + Array.from({ length: width }, () => '<w:gridCol w:w="' + cellW + '"/>').join("")
        + "</w:tblGrid>";
      out.push('<w:tbl><w:tblPr>'
        + '<w:tblW w:w="0" w:type="auto"/>'
        + '<w:tblBorders><w:insideH w:val="single" w:sz="4" w:color="CCCCCC"/>'
        + '<w:bottom w:val="single" w:sz="4" w:color="CCCCCC"/></w:tblBorders>'
        + "</w:tblPr>" + grid + rows.join("") + "</w:tbl>");
      out.push(para(""));
    }
  }
  return out.join("");
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr>
<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="21"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="130" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault>
</w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont"><w:name w:val="Default Paragraph Font"/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:pPr><w:spacing w:after="80"/></w:pPr><w:rPr><w:b/><w:sz w:val="46"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Subtle"><w:name w:val="Subtle"/><w:pPr><w:spacing w:after="40"/></w:pPr><w:rPr><w:color w:val="5A5F66"/><w:sz w:val="17"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:spacing w:before="300" w:after="110"/><w:keepNext/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:pPr><w:spacing w:before="260" w:after="90"/><w:keepNext/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:pPr><w:spacing w:before="200" w:after="70"/><w:keepNext/></w:pPr><w:rPr><w:b/><w:sz w:val="23"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading4"><w:name w:val="heading 4"/><w:pPr><w:spacing w:before="170" w:after="60"/><w:keepNext/></w:pPr><w:rPr><w:b/><w:i/><w:sz w:val="21"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:pPr><w:spacing w:after="70"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:pPr><w:ind w:left="480"/></w:pPr><w:rPr><w:i/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="caption"/><w:pPr><w:spacing w:after="140"/></w:pPr><w:rPr><w:i/><w:color w:val="5A5F66"/><w:sz w:val="18"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:pPr><w:spacing w:after="0"/><w:ind w:left="360"/></w:pPr><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="18"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="TableText"><w:name w:val="Table Text"/><w:pPr><w:spacing w:after="40"/></w:pPr><w:rPr><w:sz w:val="19"/></w:rPr></w:style>
</w:styles>`;

export function toDocx(page) {
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${docxBody(page)}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/>
<w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080"/></w:sectPr></w:body></w:document>`;

  return zip([
    {
      name: "[Content_Types].xml",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`,
    },
    {
      name: "_rels/.rels",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
    },
    {
      name: "word/_rels/document.xml.rels",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    },
    { name: "word/styles.xml", text: STYLES },
    { name: "word/document.xml", text: document },
  ]);
}

/* ─────────────────────────────── delivery ─────────────────────────────── */

function slug(s) {
  return (s || "page").toLowerCase().replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "").slice(0, 60) || "page";
}

function save(data, filename, mime) {
  const blob = data instanceof Uint8Array
    ? new Blob([data], { type: mime })
    : new Blob([data], { type: mime + ";charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function exportAs(format, doc = document) {
  const page = readPage(doc);
  const name = slug(page.title);
  if (format === "md") save(toMarkdown(page), name + ".md", "text/markdown");
  else if (format === "txt") save(toText(page), name + ".txt", "text/plain");
  else if (format === "docx") {
    save(toDocx(page), name + ".docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  } else if (format === "print") window.print();
  return page;
}

/* ─────────────────────────────── the control ──────────────────────────── */

const FORMATS = [
  ["md", "Markdown", "Structured text, for notes and repositories"],
  ["txt", "Plain text", "No formatting, opens anywhere"],
  ["docx", "Word", "Editable, opens in Word, Pages, or LibreOffice"],
  ["print", "Print or PDF", "Uses your browser's print dialog"],
];

let panelCount = 0;

// The panel goes in the top layer via the popover attribute rather than being
// positioned inside the page. This control lands on 80 pages with layouts it
// knows nothing about, and the first version was a plain absolutely-positioned
// dropdown: on the gallery it opened underneath the footer, which sat in a
// higher stacking context, so the buttons were visible and unclickable. Raising
// a z-index only moves that problem to the next page with a transform or a
// filter on an ancestor, because either one traps a fixed child in its own
// context. The top layer is outside all of that by definition.
function buildMenu() {
  const wrap = document.createElement("div");
  wrap.className = "export-menu";

  const id = "export-panel-" + (++panelCount);
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "export-toggle";
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", id);
  toggle.textContent = "Take this page";
  wrap.appendChild(toggle);

  const list = document.createElement("div");
  list.className = "export-list";
  list.id = id;
  const supportsPopover = typeof list.showPopover === "function";
  if (supportsPopover) list.setAttribute("popover", "auto");
  else list.hidden = true;

  const note = document.createElement("p");
  note.className = "export-note";
  const NOTE = "Converted in your browser from the page you are reading. Nothing is uploaded.";
  note.textContent = NOTE;
  list.appendChild(note);

  for (const [format, label, hint] of FORMATS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "export-action";
    b.dataset.exportFormat = format;
    const l = document.createElement("span");
    l.className = "export-label";
    l.textContent = label;
    const h = document.createElement("span");
    h.className = "export-hint";
    h.textContent = hint;
    b.append(l, h);
    b.addEventListener("click", () => {
      try {
        exportAs(format);
        note.textContent = NOTE;
        close();
      } catch (err) {
        note.textContent = "That export failed: " + err.message;
      }
    });
    list.appendChild(b);
  }

  // The panel lives on <body> so no ancestor can clip it with overflow.
  document.body.appendChild(list);

  // Anchor to the button, then clamp into the viewport. The clamp is the part
  // that matters: the button can be far outside the viewport when this runs,
  // because a reader can scroll after opening the panel and because a long
  // page can put the control thousands of pixels down. Without the clamp the
  // panel is positioned relative to wherever the button went and leaves the
  // screen with it, open and unreachable.
  const place = () => {
    const r = toggle.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = 8;
    const w = Math.min(list.offsetWidth || 304, vw - pad * 2);
    const h = Math.min(list.offsetHeight || 300, vh - pad * 2);

    let left = r.left;
    if (left + w > vw - pad) left = vw - w - pad;
    list.style.left = Math.round(Math.max(pad, left)) + "px";

    // prefer below the button, flip above when there is more room there
    const below = vh - r.bottom;
    const above = r.top;
    let top = (below < h + 6 && above > below) ? r.top - h - 6 : r.bottom + 6;
    top = Math.max(pad, Math.min(top, vh - h - pad));
    list.style.bottom = "auto";
    list.style.top = Math.round(top) + "px";
  };

  const isOpen = () => toggle.getAttribute("aria-expanded") === "true";
  const open = () => {
    if (supportsPopover) list.showPopover();
    else list.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    place();
    const first = list.querySelector(".export-action");
    if (first) first.focus();
  };
  function close() {
    if (supportsPopover) { if (list.matches(":popover-open")) list.hidePopover(); }
    else list.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
  }
  toggle.addEventListener("click", () => (isOpen() ? close() : open()));
  list.addEventListener("toggle", (ev) => {
    if (ev.newState === "closed") toggle.setAttribute("aria-expanded", "false");
  });
  list.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") { close(); toggle.focus(); }
  });
  // Light dismiss comes free with an auto popover; the fallback needs it wired.
  if (!supportsPopover) {
    document.addEventListener("click", (ev) => {
      if (isOpen() && !list.contains(ev.target) && ev.target !== toggle) close();
    });
  }
  addEventListener("resize", () => { if (isOpen()) place(); });
  addEventListener("scroll", () => { if (isOpen()) place(); }, { passive: true });

  return wrap;
}

export function mountExport(doc = document) {
  if (!doc || !doc.body) return;
  if (doc.querySelector(".export-menu")) return;
  const root = contentRoot(doc);
  if (!root) return;
  // Nothing to take from a page that is an instrument rather than a document.
  if (readPage(doc).blocks.length < 2) return;

  const bar = doc.createElement("div");
  bar.className = "export-bar";
  bar.appendChild(buildMenu("export-menu"));

  // Where a page names its own spot, use it. Otherwise the control goes after
  // the reading matter, which is where somebody who has finished the page and
  // wants to keep it will look for it.
  const slot = doc.querySelector("[data-export-slot]");
  if (slot) slot.appendChild(bar);
  else root.appendChild(bar);
}

if (typeof document !== "undefined" && !document.documentElement.dataset.exportManual) {
  const boot = () => { try { mountExport(document); } catch (_) {} };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
}
