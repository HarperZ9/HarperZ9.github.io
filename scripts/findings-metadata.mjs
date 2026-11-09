// findings-metadata.mjs: take author metadata out of a finding's PNG figures and PDF before the site carries them,
// the same way the site's publish metadata gate fixes files (Flywheel scripts/publish_metadata_binary.py):
//   PNG  drop the tEXt, zTXt, iTXt, eXIf and tIME chunks; colour chunks and image data stay
//   PDF  blank each /Author and /Creator string with spaces of the same length, so xref offsets stay valid
// The author's name stays where a reader sees it, on the paper's first page; only the hidden fields go.
// A PDF's site copy therefore differs from its build receipt's hash by those blanked bytes alone: blank the same
// fields in a rebuild and the two match (findings/data/copies.json records both hashes).
const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const DROP = new Set(["tEXt", "zTXt", "iTXt", "eXIf", "tIME"]);

export function stripPng(buf) {
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error("not a PNG");
  const parts = [SIG];
  let pos = 8;
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos), kind = buf.toString("latin1", pos + 4, pos + 8), end = pos + 12 + len;
    if (!DROP.has(kind)) parts.push(buf.subarray(pos, end));
    pos = end;
    if (kind === "IEND") break;
  }
  return Buffer.concat(parts);
}

const PDF_KEYS = /\/(Author|Creator)\s*(\((?:\\.|[^\\)])*\)|<[0-9A-Fa-f\s]*>)/g;

export function blankPdf(buf) {
  const s = buf.toString("latin1").replace(PDF_KEYS, (m, key, value) => m.slice(0, m.length - value.length) + value[0] + " ".repeat(value.length - 2) + value[value.length - 1]);
  if (/<x:xmpmeta/.test(s)) throw new Error("PDF carries an XMP packet; rebuild it without one");
  return Buffer.from(s, "latin1");
}

// the PNG chunks and PDF fields the gate would still flag; empty means clean
export function leftover(buf, kind) {
  if (kind === "png") {
    const out = []; let pos = 8;
    while (pos + 8 <= buf.length) { const len = buf.readUInt32BE(pos), k = buf.toString("latin1", pos + 4, pos + 8); if (DROP.has(k)) out.push(k); pos += 12 + len; if (k === "IEND") break; }
    return out;
  }
  return [...buf.toString("latin1").matchAll(PDF_KEYS)].filter((m) => m[2].slice(1, -1).trim() && !/^feff$/i.test(m[2].slice(1, -1).trim())).map((m) => m[1]);
}
