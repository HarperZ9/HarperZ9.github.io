// findings-paper.mjs: read a findings paper's source (findings/src/<id>/paper.txt), the same format the workshop's
// paper generator writes into BuildTeX. A front block (id, title, subtitle, version, date, line, ...), then lines:
//   # abstract | # section Title {sec:label} | ## Subtitle {label} | $$ maths {eq:label}
//   ![fig:label width=.. alt=Words](file.png) Caption | ::table tab:label cols=.. Caption, rows split by a broken bar,
//   closed by ::end | - item | [key] Reference text (inside "# references") | anything else is paragraph text.
// Inline marks: {m:..} maths, {cite:a,b}, {ref:label}, {i:..}, {b:..}, claim marks {c1}words{/c1} and term marks
// {g:key}words{/g} at a term's first use. inline() turns a paragraph into a small tree the page renderer walks.

const SEP = "¦";

export function front(text) {
  const m = text.replace(/\r/g, "").match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error("paper: no front block");
  const meta = {};
  for (const line of m[1].split("\n")) { const i = line.indexOf(":"); if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim(); }
  return { meta, body: m[2] };
}

const label = (text) => { const m = text.match(/^(.*?)\s*\{([a-z]+:[^}]+)\}$/); return m ? [m[1], m[2]] : [text, ""]; };

function figure(line) {
  const m = line.match(/^!\[(\S+)((?: \w+=[^ \]]+)*)(?: alt=([^\]]*))?\]\(([^)]+)\)\s*(.*)$/);
  if (!m) throw new Error(`paper: bad figure line ${line.slice(0, 60)}`);
  const opts = Object.fromEntries(m[2].trim().split(/\s+/).filter(Boolean).map((o) => o.split("=")));
  return { kind: "figure", label: m[1], src: m[4], alt: m[3] || "", width: Number(opts.width || 1), caption: m[5] };
}

// blocks(body) -> [{kind, label, text, ...}] in reading order, the same reading as the paper generator's
export function blocks(body) {
  const out = [], para = [];
  let mode = "body", table = null, inRefs = false;
  const flush = () => { if (para.length) { out.push({ kind: mode === "abstract" ? "abstract" : "p", text: para.join(" ") }); para.length = 0; } };
  for (const raw of body.split("\n")) {
    const line = raw.trimEnd();
    if (table) {
      if (line === "::end") { out.push(table); table = null; } else if (line.trim()) table.rows.push(line.split(SEP).map((c) => c.trim()));
      continue;
    }
    if (!line.trim()) { flush(); continue; }
    if (line.startsWith("# ")) {
      flush();
      const head = line.slice(2).trim();
      if (head === "abstract") { mode = "abstract"; continue; }
      mode = "body"; inRefs = head === "references";
      const [title, lab] = label(head.replace(/^section /, ""));
      out.push({ kind: "section", label: lab || (inRefs ? "sec:references" : ""), text: inRefs ? "References" : title });
    } else if (line.startsWith("## ")) { flush(); const [t, l] = label(line.slice(3).trim()); out.push({ kind: "subsection", label: l, text: t }); }
    else if (line.startsWith("$$")) { flush(); const [s, l] = label(line.slice(2).trim()); out.push({ kind: "eq", label: l, text: s }); }
    else if (line.startsWith("![")) { flush(); out.push(figure(line)); }
    else if (line.startsWith("::table")) {
      flush();
      const m = line.match(/^::table (\S+) cols=(\S+)\s+(.*)$/);
      table = { kind: "table", label: m[1], cols: m[2].split(",").map(Number), caption: m[3], rows: [] };
    } else if (line.startsWith("- ")) { flush(); out.push({ kind: "li", text: line.slice(2).trim() }); }
    else if (inRefs && line.startsWith("[")) { flush(); const i = line.indexOf("] "); out.push({ kind: "bib", label: line.slice(1, i), text: line.slice(i + 2).trim() }); }
    else para.push(line.trim());
  }
  flush();
  if (table) throw new Error("paper: table without ::end");
  return out;
}

// read(text) -> { meta, abstract: [paragraph], sections: [{label, title, blocks}], bib: [{key, text}], numbers }
// numbers maps each label (fig:, tab:, eq:, sec:) to the number a reader sees, in reading order
export function read(text) {
  const { meta, body } = front(text);
  const bl = blocks(body), abstract = [], sections = [], bib = [], numbers = {};
  const count = { fig: 0, tab: 0, eq: 0, sec: 0 };
  let cur = null;
  for (const b of bl) {
    if (b.kind === "abstract") { abstract.push(b.text); continue; }
    if (b.kind === "bib") { bib.push({ key: b.label, text: b.text }); continue; }
    if (b.kind === "section") {
      if (b.text !== "References") numbers[b.label] = String(++count.sec);
      cur = { label: b.label, title: b.text, blocks: [] }; sections.push(cur); continue;
    }
    const kind = (b.label || "").split(":")[0];
    if (count[kind] !== undefined && b.label) numbers[b.label] = String(++count[kind]);
    if (!cur) throw new Error(`paper: ${b.kind} before any section`);
    cur.blocks.push(b);
  }
  return { meta, abstract, sections: sections.filter((s) => s.title !== "References"), bib, numbers };
}

// the closing brace that matches the opening one at i (braces nest inside maths)
function closeOf(s, i) {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === "{") depth++;
    else if (s[j] === "}" && --depth === 0) return j;
  }
  throw new Error(`paper: unclosed mark in "${s.slice(i, i + 50)}"`);
}

// inline(text) -> nodes: {t:"text",v} {t:"claim",id,kids} {t:"term",key,kids} {t:"math",v} {t:"cite",keys} {t:"ref",label}
// {t:"i",kids} {t:"b",kids}
export function inline(s) {
  const out = [];
  let i = 0, buf = "";
  const push = (n) => { if (buf) { out.push({ t: "text", v: buf }); buf = ""; } out.push(n); };
  while (i < s.length) {
    const rest = s.slice(i);
    let m;
    if ((m = rest.match(/^\{(c\d+)\}/))) {
      const end = s.indexOf(`{/${m[1]}}`, i);
      if (end < 0) throw new Error(`paper: claim ${m[1]} not closed`);
      push({ t: "claim", id: m[1], src: s.slice(i + m[0].length, end), kids: inline(s.slice(i + m[0].length, end)) });
      i = end + m[1].length + 3;
    } else if ((m = rest.match(/^\{g:([a-z0-9-]+)\}/))) {
      const end = s.indexOf("{/g}", i);
      if (end < 0) throw new Error(`paper: term ${m[1]} not closed`);
      push({ t: "term", key: m[1], kids: inline(s.slice(i + m[0].length, end)) });
      i = end + 4;
    } else if ((m = rest.match(/^\{(m|cite|ref|i|b):/))) {
      const end = closeOf(s, i), v = s.slice(i + m[0].length, end);
      if (m[1] === "m") push({ t: "math", v });
      else if (m[1] === "cite") push({ t: "cite", keys: v.split(",").map((k) => k.trim()) });
      else if (m[1] === "ref") push({ t: "ref", label: v.trim() });
      else push({ t: m[1], kids: inline(v) });
      i = end + 1;
    } else { buf += s[i]; i++; }
  }
  if (buf) out.push({ t: "text", v: buf });
  return out;
}

// the plain words of a marked text: claim and term marks dropped, maths kept as its source
export const plain = (s) => s.replace(/\{\/?c\d+\}/g, "").replace(/\{g:[a-z0-9-]+\}|\{\/g\}/g, "");
