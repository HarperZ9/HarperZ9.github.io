// studies-markdown.mjs: the small Markdown reader the study pages need, and the public-reading filter.
//
// toHTML(md) handles what the reference library's STUDY.md files use: ## and ### headings, paragraphs,
// nested bullet and numbered lists, pipe tables, **bold**, *italic*, `code`, [links](url) and bare URLs.
// publicText(md) drops what belongs to the workshop rather than the reader: sentences that name local files,
// tools, scripts or the sessions that wrote them, and any drive path. What remains is the study itself.

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// A code span that names a file, a folder or a tool, or a sentence that talks about the workshop.
const WORKSHOP = [
  /`[^`]*(?:[\\/]|\.(?:json|jsonl|py|md|mjs|js|jpg|jpeg|png|webp|mp4|webm|wav|csv|txt)\b)[^`]*`/i,
  /\b[A-Za-z]:[\\/]/, /\bcoordinator\b/i, /\bClaude\b/, /\bOpus\b/, /\bsession\b/i, /\brefdb\b/, /\bagent_parts\b/,
  /\bprobe\b/i, /\bsidecar\b/i, /\bDaylight\b.*\bbug\b/i, /\bour libraries\b/i, /\bprivate study\b/i,
];
const workshop = (s) => WORKSHOP.some((re) => re.test(s));

function sentences(text) {
  // keep abbreviations and decimals whole: split only on ". " followed by a capital, a digit or an opening mark
  return text.split(/(?<=[.!?])\s+(?=[A-Z0-9*"(“])/);
}
export function publicLine(line) {
  if (line.trim().startsWith("|")) return line.split("|").map((c) => (workshop(c) ? " " : c)).join("|");
  const m = line.match(/^(\s*(?:[-*]|\d+\.(?:\s+to\s+\d+\.)?)\s+)?([\s\S]*)$/);
  const lead = m[1] || "", kept = sentences(m[2]).filter((s) => !workshop(s)).join(" ");
  return kept.trim() ? lead + kept : null;
}
export function publicText(md) {
  return md.split("\n").map((l) => (l.trim() ? publicLine(l) : l)).filter((l) => l !== null).join("\n");
}

function inline(s) {
  let t = esc(s);
  t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
  t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s).,;:!?]|$)/g, "$1<em>$2</em>");
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
  t = t.replace(/(^|[\s(])(https?:\/\/[^\s<)]+[^\s<).,;:])/g, '$1<a href="$2">$2</a>');
  return t;
}

function table(rows) {
  const cells = (r) => r.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
  const head = cells(rows[0]), body = rows.slice(2).map(cells);
  return `<div class="st-table" role="region" aria-label="${esc(head.join(", "))}" tabindex="0"><table><thead><tr>${head.map((h) => `<th scope="col">${inline(h)}</th>`).join("")}</tr></thead>` +
    `<tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

// Lists: a stack of open lists by indent. Each item is "- text" or "1. text" (also "2. to 4. text").
function list(lines) {
  let out = "", stack = [];
  for (const l of lines) {
    const m = l.match(/^(\s*)([-*]|\d+\.(?:\s+to\s+\d+\.)?)\s+(.*)$/);
    if (!m) { out += " " + inline(l.trim()); continue; }
    const depth = Math.floor(m[1].length / 2), tag = /\d/.test(m[2]) ? "ol" : "ul";
    while (stack.length > depth + 1) out += `</li></${stack.pop()}>`;
    if (stack.length === depth + 1) out += "</li>";
    while (stack.length < depth + 1) { out += `<${tag}>`; stack.push(tag); }
    const label = tag === "ol" && m[2].includes("to") ? `<span class="st-n">${esc(m[2])}</span> ` : "";
    out += `<li>${label}${inline(m[3])}`;
  }
  while (stack.length) out += `</li></${stack.pop()}>`;
  return out;
}

export function toHTML(md, { idPrefix = "s" } = {}) {
  const lines = md.replace(/\r/g, "").split("\n"), out = [];
  let i = 0, n = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim() || /^<!--.*-->$/.test(l.trim())) { i++; continue; }
    const h = l.match(/^(#{2,4})\s+(.*)$/);
    if (h) { const lv = h[1].length; out.push(`<h${lv} id="${idPrefix}-${++n}">${inline(h[2].replace(/^\d+\.\s+/, ""))}</h${lv}>`); i++; continue; }
    if (l.trim().startsWith("|")) { const t = []; while (i < lines.length && lines[i].trim().startsWith("|")) t.push(lines[i++]); out.push(table(t)); continue; }
    if (/^\s*([-*]|\d+\.)\s+/.test(l)) { const t = []; while (i < lines.length && lines[i].trim() && (/^\s*([-*]|\d+\.)\s+/.test(lines[i]) || /^\s{2,}\S/.test(lines[i]))) t.push(lines[i++]); out.push(list(t)); continue; }
    if (l.startsWith("```")) { const t = []; i++; while (i < lines.length && !lines[i].startsWith("```")) t.push(lines[i++]); i++; out.push(`<pre><code>${esc(t.join("\n"))}</code></pre>`); continue; }
    const p = []; while (i < lines.length && lines[i].trim() && !/^(#{2,4}\s|\s*\||\s*[-*]\s|\s*\d+\.\s|```)/.test(lines[i])) p.push(lines[i++].trim());
    if (p.length) out.push(`<p>${inline(p.join(" "))}</p>`); else i++;
  }
  return out.join("\n");
}

export { esc };
