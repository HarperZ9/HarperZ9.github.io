const escapeHtml = (value) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;");

const inline = (value) => {
  const code = [];
  let text = escapeHtml(value).replace(/`([^`]+)`/g, (_match, body) => {
    const token = `@@CODE${code.length}@@`;
    code.push(`<code>${body}</code>`);
    return token;
  });

  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a class="inline" href="$2" rel="external noopener">$1</a>');
  text = text.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  code.forEach((snippet, index) => {
    text = text.replace(`@@CODE${index}@@`, snippet);
  });
  return text;
};

const slug = (value) => value.toLowerCase()
  .replace(/[^a-z0-9\s-]/g, "")
  .trim()
  .replace(/\s+/g, "-");

const stripDocumentHeader = (lines) => {
  const work = [...lines];
  const dropBlank = () => {
    while (work.length && !work[0].trim()) work.shift();
  };

  dropBlank();
  if (work[0]?.startsWith("# ")) work.shift();
  dropBlank();
  if (work[0]?.startsWith("## ")) work.shift();
  dropBlank();
  if (/^\*[^*]+\*$/.test(work[0]?.trim() || "")) work.shift();
  dropBlank();
  return work;
};

const renderMarkdown = (source, mode) => {
  const lines = stripDocumentHeader(source.replaceAll("\r\n", "\n").split("\n"));
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();

    if (!line) {
      i += 1;
      continue;
    }

    if (line === "---") {
      out.push("<hr>");
      i += 1;
      continue;
    }

    if (line.startsWith("## ")) {
      const label = line.slice(3).trim();
      out.push(`<h2 id="${slug(label)}">${inline(label)}</h2>`);
      i += 1;
      continue;
    }

    if (line.startsWith("> ")) {
      const quote = [];
      while (i < lines.length && lines[i].trim().startsWith("> ")) {
        quote.push(lines[i].trim().slice(2));
        i += 1;
      }
      out.push(`<blockquote class="content-note"><p>${inline(quote.join(" "))}</p></blockquote>`);
      continue;
    }

    if (line.startsWith("- ")) {
      const items = [];
      while (i < lines.length && lines[i].trim().startsWith("- ")) {
        items.push(`<li>${inline(lines[i].trim().slice(2))}</li>`);
        i += 1;
      }
      out.push(`<ul class="${out.at(-1)?.startsWith('<h2 id="sources"') ? 'source-list' : ''}">${items.join("")}</ul>`);
      continue;
    }

    const paragraph = [line];
    i += 1;
    while (i < lines.length) {
      const next = lines[i].trim();
      if (!next || next === "---" || next.startsWith("## ") || next.startsWith("> ") || next.startsWith("- ")) break;
      paragraph.push(next);
      i += 1;
    }
    const value = paragraph.join(" ");
    const cue = mode === "talk" && value.startsWith("[") && value.endsWith("]");
    out.push(`<p${cue ? ' class="cue"' : ""}>${inline(value)}</p>`);
  }

  return out.join("\n");
};

const loadEssay = async (root) => {
  const parts = root.dataset.markdownParts.split(",").map((value) => value.trim()).filter(Boolean);
  const mode = root.dataset.mode || "essay";
  const responses = await Promise.all(parts.map(async (path) => {
    const response = await fetch(path, { cache: "no-cache" });
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return response.text();
  }));
  const source = responses.join("");
  root.innerHTML = renderMarkdown(source, mode);
  root.dataset.loaded = "true";
  const count = source.match(/\b[\w’'-]+\b/g)?.length || 0;
  const counter = document.querySelector("[data-word-count]");
  if (counter) counter.textContent = count.toLocaleString();
};

const root = document.querySelector("[data-markdown-parts]");
if (root) {
  loadEssay(root).catch((error) => {
    console.error(error);
    const links = root.dataset.markdownParts.split(",").map((path, index) =>
      `<li><a class="inline" href="${path.trim()}">Raw source ${index + 1}</a></li>`).join("");
    root.innerHTML = `<p>The essay could not be rendered in this browser. The plain-text source remains available:</p><ul>${links}</ul>`;
  });
}
