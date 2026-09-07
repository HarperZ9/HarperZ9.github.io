import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const FIGURE_ID = "incident-multilane-timeline";
const JSON_PATH = path.join(ROOT, "figures", `${FIGURE_ID}.json`);
const HTML_PATH = path.join(ROOT, "figures", `${FIGURE_ID}.html`);
const SVG_PATH = path.join(ROOT, "figures", `${FIGURE_ID}.svg`);

const SVG_WIDTH = 640;
const SVG_TOP = 166;
const SVG_LEFT_GUTTER = 18;
const SVG_SPINE_X = 130;
const SVG_CARD_X = 150;
const SVG_CARD_WIDTH = 470;
const SVG_CARD_INSET = 12;
const SVG_GROUP_GAP = 24;
const SVG_EVENT_GAP = 12;
const SVG_LINE_HEIGHT = 25;
const SVG_BOTTOM_PAD = 116;
const SVG_FOOTER_HEIGHT = 84;
const META_WRAP_CHARS = 32;
const LABEL_WRAP_CHARS = 29;

const LANE_ACCENTS = new Map([
  ["Legal process", "#8d70db"],
  ["OpenAI company report", "#d47a5a"],
  ["Hugging Face host telemetry", "#54c9d1"],
  ["METR and Redwood independent investigation", "#8fbf6c"],
  ["Vendor remediation", "#d4ad5a"],
]);

const STATUS_TOKENS = {
  verified: {
    label: "Verified",
    className: "verified",
    stroke: "var(--verified)",
    fill: "var(--verified-soft)",
    dash: "",
  },
  caution: {
    label: "Caution",
    className: "caution",
    stroke: "var(--caution)",
    fill: "var(--caution-soft)",
    dash: ' stroke-dasharray="8 6"',
  },
};

const HTML_ENTITIES = new Map([
  ["&", "&amp;"],
  ["<", "&lt;"],
  [">", "&gt;"],
  ['"', "&quot;"],
  ["'", "&apos;"],
]);

function escapeMarkup(value) {
  return String(value).replace(/[&<>"']/g, (character) => HTML_ENTITIES.get(character));
}

function wrapWords(value, maxCharacters) {
  const words = String(value).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }
    if (`${current} ${word}`.length <= maxCharacters) {
      current = `${current} ${word}`;
      continue;
    }
    lines.push(current);
    current = word;
  }

  if (current) {
    lines.push(current);
  }
  return lines.length ? lines : [""];
}

function statusFor(item) {
  return STATUS_TOKENS[item.status] ?? {
    label: String(item.status).replace(/^\w/, (character) => character.toUpperCase()),
    className: "unknown",
    stroke: "var(--muted)",
    fill: "transparent",
    dash: ' stroke-dasharray="3 5"',
  };
}

function groupByDate(items) {
  const groups = [];
  const seen = new Map();
  items.forEach((item, index) => {
    if (!seen.has(item.date)) {
      const group = { date: item.date, items: [] };
      groups.push(group);
      seen.set(item.date, group);
    }
    seen.get(item.date).items.push({ item, index });
  });
  return groups;
}

function lineText({ x, y, lines, size = 18, className = "", weight = "", lineHeight = SVG_LINE_HEIGHT }) {
  const attrs = [
    `x="${x}"`,
    `y="${y}"`,
    `font-size="${size}"`,
    className ? `class="${className}"` : "",
    weight ? `font-weight="${weight}"` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return [
    `<text ${attrs}>`,
    lines
      .map((line, index) => {
        const dy = index === 0 ? 0 : lineHeight;
        return `<tspan x="${x}" dy="${dy}">${escapeMarkup(line)}</tspan>`;
      })
      .join(""),
    "</text>",
  ].join("");
}

function eventMeta(item) {
  const status = statusFor(item);
  return `${item.date} | ${item.lane} | ${status.label} | Source IDs ${item.sourceIds.join(", ")}`;
}

function eventHeight(item) {
  const metaLines = wrapWords(eventMeta(item), META_WRAP_CHARS);
  const labelLines = wrapWords(item.label, LABEL_WRAP_CHARS);
  return 44 + metaLines.length * 22 + labelLines.length * 28;
}

function groupHeight(group) {
  const eventsHeight = group.items.reduce((total, { item }) => total + eventHeight(item), 0);
  return 30 + eventsHeight + Math.max(0, group.items.length - 1) * SVG_EVENT_GAP + 22;
}

function renderEvent({ item, index, x, y, width, height }) {
  const status = statusFor(item);
  const laneAccent = LANE_ACCENTS.get(item.lane) ?? "var(--muted)";
  const sourceIds = item.sourceIds.join(", ");
  const metaLines = wrapWords(eventMeta(item), META_WRAP_CHARS);
  const labelLines = wrapWords(item.label, LABEL_WRAP_CHARS);
  const labelY = y + 34 + metaLines.length * 22;
  const aria = `${item.date}. ${item.lane}. ${item.label}. ${status.label}. Source IDs: ${sourceIds}.`;
  const key = `timeline:${index}`;

  return `<g data-figure-point="true" data-figure-key="${key}" data-date="${escapeMarkup(item.date)}" data-lane="${escapeMarkup(item.lane)}" data-state="${escapeMarkup(item.status)}" data-status-label="${escapeMarkup(status.label)}" role="graphics-symbol" aria-label="${escapeMarkup(aria)}" tabindex="-1">
    <rect class="focus-ring" x="${x - 4}" y="${y - 4}" width="${width + 8}" height="${height + 8}" rx="22" fill="none" stroke="transparent" stroke-width="4"/>
    <rect class="event-card ${status.className}" x="${x}" y="${y}" width="${width}" height="${height}" rx="18" fill="${status.fill}" stroke="${status.stroke}" stroke-width="2"${status.dash}/>
    <rect x="${x}" y="${y}" width="10" height="${height}" rx="5" fill="${laneAccent}"/>
    <circle cx="${x + 30}" cy="${y + 31}" r="9" fill="${laneAccent}" stroke="${status.stroke}" stroke-width="2"/>
    ${lineText({ x: x + 52, y: y + 29, lines: metaLines, size: 18, className: "mono meta", lineHeight: 22 })}
    ${lineText({ x: x + 52, y: labelY, lines: labelLines, size: 24, className: "label", weight: "650", lineHeight: 28 })}
  </g>`;
}

function renderSvg(companion) {
  const figure = companion.figure;
  const items = figure.data.items;
  const groups = groupByDate(items);
  const groupHeights = groups.map(groupHeight);
  const timelineHeight = groupHeights.reduce((total, value) => total + value, 0) + Math.max(0, groups.length - 1) * SVG_GROUP_GAP;
  const footerY = SVG_TOP + timelineHeight + 44;
  const svgHeight = footerY + SVG_FOOTER_HEIGHT + SVG_BOTTOM_PAD;

  let cursorY = SVG_TOP;
  const groupMarkup = groups
    .map((group, groupIndex) => {
      const height = groupHeights[groupIndex];
      const dateY = cursorY + 26;
      let eventY = cursorY + 30;
      const itemsMarkup = group.items
        .map(({ item, index }) => {
          const heightForItem = eventHeight(item);
          const markup = renderEvent({
            item,
            index,
            x: SVG_CARD_X + SVG_CARD_INSET,
            y: eventY,
            width: SVG_CARD_WIDTH - SVG_CARD_INSET * 2,
            height: heightForItem,
          });
          eventY += heightForItem + SVG_EVENT_GAP;
          return markup;
        })
        .join("\n    ");

      const nextCursor = cursorY + height + SVG_GROUP_GAP;
      const output = `<g data-timeline-date="${escapeMarkup(group.date)}">
    <line x1="${SVG_SPINE_X}" y1="${cursorY + 6}" x2="${SVG_SPINE_X}" y2="${cursorY + height - 8}" class="spine-segment"/>
    <circle cx="${SVG_SPINE_X}" cy="${dateY}" r="13" class="date-node"/>
    <line x1="${SVG_SPINE_X + 19}" y1="${dateY}" x2="${SVG_CARD_X - 18}" y2="${dateY}" class="date-leader"/>
    <rect x="${SVG_LEFT_GUTTER}" y="${dateY - 23}" width="100" height="46" rx="17" class="date-badge"/>
    <text x="${SVG_LEFT_GUTTER + 50}" y="${dateY + 6}" text-anchor="middle" font-size="18" class="mono date-text">${escapeMarkup(group.date)}</text>
    <rect x="${SVG_CARD_X}" y="${cursorY}" width="${SVG_CARD_WIDTH}" height="${height}" rx="26" class="date-card"/>
    ${itemsMarkup}
  </g>`;
      cursorY = nextCursor;
      return output;
    })
    .join("\n  ");

  return `<svg role="img" width="${SVG_WIDTH}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SVG_WIDTH} ${svgHeight}" aria-labelledby="${FIGURE_ID}-title ${FIGURE_ID}-desc" data-figure-kind="timeline" data-layout="grouped-vertical">
  <title id="${FIGURE_ID}-title">${escapeMarkup(figure.title)}</title>
  <desc id="${FIGURE_ID}-desc">${escapeMarkup(figure.description)} ${escapeMarkup(figure.claim)}</desc>
  <style>
    svg{color-scheme:light dark;--bg:#f7fbfb;--panel:#ffffff;--panel-2:#eef5f5;--line:#b8cacc;--line-strong:#718c92;--text:#172126;--muted:#526a70;--verified:#007f7a;--verified-soft:#e3f6f4;--caution:#a54d2f;--caution-soft:#fff0e9;--shadow:#c8d6d6}
    @media (prefers-color-scheme:dark){svg{--bg:#0b1115;--panel:#101a20;--panel-2:#16252c;--line:#36505a;--line-strong:#5f7a82;--text:#f2f8f8;--muted:#b9cbd0;--verified:#54c9d1;--verified-soft:#13262b;--caution:#d47a5a;--caution-soft:#291b18;--shadow:#061015}}
    text{font-family:"Hanken Grotesk",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;fill:var(--text)}
    .mono{font-family:"Conso","JetBrains Mono",ui-monospace,"SFMono-Regular",monospace}
    .muted,.meta,.legend-text{fill:var(--muted)}
    .label{fill:var(--text)}
    .spine-segment,.date-leader{stroke:var(--line-strong);stroke-width:2}
    .date-node{fill:var(--panel);stroke:var(--line-strong);stroke-width:3}
    .date-badge{fill:var(--panel-2);stroke:var(--line);stroke-width:1.5}
    .date-card{fill:var(--panel);stroke:var(--line);stroke-width:1.5}
    .event-card{filter:drop-shadow(0 5px 14px var(--shadow))}
    .focus-ring{pointer-events:none}
    [data-figure-point]:focus{outline:none}
    [data-figure-point]:focus-visible .focus-ring{stroke:var(--verified)}
  </style>
  <rect width="${SVG_WIDTH}" height="${svgHeight}" fill="var(--bg)"/>
  <text x="34" y="42" font-size="28" font-weight="750">Selected public chronology</text>
  <text x="34" y="72" font-size="19" class="muted">Grouped by date. Evidence lanes and states stay separate.</text>
  <text x="34" y="98" font-size="19" class="muted">No causal connectors are drawn.</text>
  <g aria-label="State legend">
    <rect x="34" y="116" width="126" height="34" rx="17" fill="var(--verified-soft)" stroke="var(--verified)" stroke-width="2"/>
    <text x="52" y="138" font-size="18" class="mono">Verified</text>
    <rect x="176" y="116" width="120" height="34" rx="17" fill="var(--caution-soft)" stroke="var(--caution)" stroke-width="2" stroke-dasharray="8 6"/>
    <text x="194" y="138" font-size="18" class="mono">Caution</text>
    <text x="314" y="138" font-size="18" class="muted">Lane/source IDs are in each record.</text>
  </g>
  ${groupMarkup}
  <g aria-label="Figure limit" transform="translate(62 ${footerY})">
    <rect x="0" y="0" width="${SVG_WIDTH - 124}" height="${SVG_FOOTER_HEIGHT}" rx="22" fill="var(--panel-2)" stroke="var(--line)" stroke-width="1.5"/>
    <text x="28" y="34" font-size="22" font-weight="750">Chronology only: date order is not causality.</text>
    <text x="28" y="62" font-size="18" class="muted">Full table preserves all ${items.length} records and source IDs.</text>
  </g>
</svg>`;
}

function renderTable(figure) {
  const rows = figure.data.items
    .map((item, index) => {
      const status = statusFor(item);
      return `<tr data-figure-row data-figure-key="timeline:${index}"><td data-label="Date"><time datetime="${escapeMarkup(item.date)}">${escapeMarkup(item.date)}</time></td><td data-label="Evidence lane">${escapeMarkup(item.lane)}</td><td data-label="Event">${escapeMarkup(item.label)}</td><td data-label="State"><span class="figure-status figure-status--${escapeMarkup(item.status)}">${escapeMarkup(status.label)}</span></td><td data-label="Source IDs">${escapeMarkup(item.sourceIds.join(", "))}</td></tr>`;
    })
    .join("\n");
  return `<div class="figure-table-wrap" tabindex="0" aria-label="Semantic table for ${escapeMarkup(figure.title)}">
    <table class="figure-table">
      <caption>Semantic data for ${escapeMarkup(figure.title)}</caption>
      <thead><tr><th scope="col">Date</th><th scope="col">Evidence lane</th><th scope="col">Event</th><th scope="col">State</th><th scope="col">Source IDs</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function renderEvidence(figure) {
  const sources = figure.sources
    .map((source) => `<li><a href="${escapeMarkup(source.href)}">${escapeMarkup(source.label)}</a></li>`)
    .join("");
  const transformations = figure.transformations
    .map((transformation) => `<li>${escapeMarkup(transformation)}</li>`)
    .join("");

  return `<dl class="figure-evidence figure-scope">
    <dt>Sources</dt><dd><ul>${sources}</ul></dd>
    <dt>Retrieved</dt><dd><time datetime="${escapeMarkup(figure.retrievedAt)}">${escapeMarkup(figure.retrievedAt)}</time></dd>
    <dt>Units</dt><dd>${escapeMarkup(figure.units)}</dd>
    <dt>Transformations</dt><dd><ul>${transformations}</ul></dd>
    <dt>Uncertainty</dt><dd>${escapeMarkup(figure.uncertainty)}</dd>
    <dt>What this figure does not prove</dt><dd class="figure-does-not-prove figure-limitations">${escapeMarkup(figure.doesNotProve)}</dd>
  </dl>`;
}

function renderHtml(companion, svg) {
  const figure = companion.figure;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeMarkup(figure.title)}</title>
  <link rel="stylesheet" href="../system/figure.css?v=20260906-figure-presentation">
  <style>
    .evidence-figure[data-figure-id="${FIGURE_ID}"] .figure-svg-scroll { --figure-svg-min-inline: 0; grid-row: 2; }
    .evidence-figure[data-figure-id="${FIGURE_ID}"] .figure-svg-scroll svg { width: min(100%, 44rem); min-width: 0; margin-inline: auto; }
    .evidence-figure[data-figure-id="${FIGURE_ID}"] .figure-table-wrap { grid-row: 3; }
    @media (max-width: 40rem) {
      .evidence-figure[data-figure-id="${FIGURE_ID}"] .figure-svg-scroll { order: 2; }
      .evidence-figure[data-figure-id="${FIGURE_ID}"] .figure-table-wrap { order: 3; margin-block-start: 1.5rem; }
      .evidence-figure[data-figure-id="${FIGURE_ID}"] .figure-table-wrap { overflow: visible; }
      .evidence-figure[data-figure-id="${FIGURE_ID}"] .figure-table,
      .evidence-figure[data-figure-id="${FIGURE_ID}"] .figure-table thead,
      .evidence-figure[data-figure-id="${FIGURE_ID}"] .figure-table tbody,
      .evidence-figure[data-figure-id="${FIGURE_ID}"] .figure-table tr,
      .evidence-figure[data-figure-id="${FIGURE_ID}"] .figure-table th,
      .evidence-figure[data-figure-id="${FIGURE_ID}"] .figure-table td { display: block; width: 100%; min-width: 0; }
      .evidence-figure[data-figure-id="${FIGURE_ID}"] .figure-table thead {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
      }
      .evidence-figure[data-figure-id="${FIGURE_ID}"] .figure-table tr {
        padding-block: 0.85rem;
        border-block-start: 1px solid var(--figure-line);
      }
      .evidence-figure[data-figure-id="${FIGURE_ID}"] .figure-table td {
        display: grid;
        grid-template-columns: minmax(6.5rem, 0.38fr) minmax(0, 1fr);
        gap: 0.65rem;
        padding: 0.25rem 0;
        border: 0;
        overflow-wrap: anywhere;
      }
      .evidence-figure[data-figure-id="${FIGURE_ID}"] .figure-table td::before {
        content: attr(data-label);
        color: var(--figure-muted);
        font-family: var(--figure-mono);
        font-size: 0.72rem;
        font-weight: 700;
      }
    }
  </style>
</head>
<body class="figure-document">
  <main>
    <figure class="evidence-figure" data-evidence-figure data-figure-kind="timeline" data-figure-id="${FIGURE_ID}">
      <figcaption class="figure-heading">
        <h1>${escapeMarkup(figure.title)}</h1>
        <p class="figure-description">${escapeMarkup(figure.description)}</p>
        <p class="figure-claim figure-finding">${escapeMarkup(figure.claim)}</p>
      </figcaption>
      <div class="figure-svg-scroll figure-svg-scroll--timeline" tabindex="0" aria-label="Readable grouped timeline visualization for ${escapeMarkup(figure.title)}">
${svg}
      </div>
      ${renderTable(figure)}
      ${renderEvidence(figure)}
    </figure>
  </main>
  <script type="module" src="../system/figure.js?v=20260902-creative-chassis"></script>
</body>
</html>
`;
}

async function render() {
  const companion = JSON.parse(await readFile(JSON_PATH, "utf8"));
  const svg = renderSvg(companion);
  const html = renderHtml(companion, svg);
  return { svg: `${svg}\n`, html };
}

async function main() {
  const check = process.argv.includes("--check");
  const { svg, html } = await render();

  if (check) {
    const [currentSvg, currentHtml] = await Promise.all([
      readFile(SVG_PATH, "utf8"),
      readFile(HTML_PATH, "utf8"),
    ]);
    const mismatches = [];
    if (currentSvg !== svg) {
      mismatches.push("figures/incident-multilane-timeline.svg");
    }
    if (currentHtml !== html) {
      mismatches.push("figures/incident-multilane-timeline.html");
    }
    if (mismatches.length) {
      console.error(`incident-multilane-timeline output drift: ${mismatches.join(", ")}`);
      process.exitCode = 1;
      return;
    }
    console.log("incident-multilane-timeline outputs match");
    return;
  }

  await Promise.all([
    writeFile(SVG_PATH, svg, "utf8"),
    writeFile(HTML_PATH, html, "utf8"),
  ]);
  console.log("rendered figures/incident-multilane-timeline.html and .svg");
}

await main();
