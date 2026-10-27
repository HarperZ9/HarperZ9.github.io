// weave-engine.js: draft mathematics and the WIF 1.1 writer.
// A draft is threading + tieup + treadling; the drawdown is the boolean
// semiring product (a cell shows warp when any active treadle is tied to that
// end's shaft). Structures and WIF mechanics follow the research record in
// crossings/research/weave.md: plain (2 shafts), 2/2 twill (4), 5-end satin
// with valid counter 2 (5 shafts, sateen + warp-faced complement), overshot
// (4 shafts, 4 pattern treadles + 2 tabby, three tonal levels).

const seq = (n) => Array.from({ length: n }, (_, i) => i);

export const STRUCTURES = {
  plain: {
    name: "Plain", shafts: 2, treadles: 2,
    threading: (i) => i % 2,
    tieup: [[0], [1]],
    treadlingBase: (i) => i % 2,
  },
  twill22: {
    name: "2/2 Twill", shafts: 4, treadles: 4,
    threading: (i) => i % 4,
    tieup: [[0, 1], [1, 2], [2, 3], [0, 3]],
    treadlingBase: (i) => i % 4,
  },
  // Weft-faced sateen rows (one shaft lifted, counter 2) in treadles 0..4;
  // warp-faced satin complements (four lifted) in treadles 5..9 for light rows.
  satin5: {
    name: "Satin 5", shafts: 5, treadles: 10,
    threading: (i) => i % 5,
    tieup: (() => {
      const counter = [0, 2, 4, 1, 3];
      const single = counter.map((s) => [s]);
      const compl = counter.map((s) => seq(5).filter((k) => k !== s));
      return single.concat(compl);
    })(),
    treadlingBase: (i) => i % 5,
  },
  // Threading from 2-thread twill blocks A=1,2 B=2,3 C=3,4 D=1,4; pattern
  // picks alternate with tabby (shafts 1+3 / 2+4), the classic "use tabby".
  overshot: {
    name: "Overshot", shafts: 4, treadles: 6,
    threading: (i) => [0, 1, 1, 2, 2, 3, 0, 3][i % 8],
    tieup: [[0, 1], [1, 2], [2, 3], [0, 3], [0, 2], [1, 3]],
    treadlingBase: (i) => (i % 2 === 0 ? (i >> 1) % 4 : 4 + ((i >> 1) % 2)),
  },
  // Jacquard shading: per-thread control, no shaft draft. The inclusive
  // shaded-satin construction on an 8-end repeat (counter 3): each brighter
  // tone adds risers to the right of the previous tone's risers, so any two
  // tones can sit adjacent with no long-float errors. 1/7 through 7/1 gives
  // seven honest gray levels; this is the photo mode, and it has no WIF.
  jacquard: {
    name: "Jacquard shade", shafts: 8, treadles: 8, perCell: true,
    threading: (i) => i % 8,
    tieup: seq(8).map((t) => [(t * 3) % 8]),
    treadlingBase: (i) => i % 8,
  },
};

// Tone steering per structure, active in proportion to toneDrive 0..1.
// Plain keeps its mandatory alternation (tone lives in the weft color);
// twill drifts its diagonal; satin flips sateen to warp-faced satin on light
// rows; overshot picks the pattern block whose float weight matches the row.
function toneTreadle(structureId, s, pick, tone, drive) {
  const base = s.treadlingBase(pick);
  if (drive <= 0 || structureId === "plain") return base;
  if (structureId === "twill22") {
    return (base + Math.floor(tone * drive * 3.999)) % 4;
  }
  if (structureId === "satin5") {
    return tone > 1 - drive * 0.5 ? 5 + (pick % 5) : base;
  }
  if (structureId === "overshot") {
    if (pick % 2 === 1) return base;
    const block = Math.max(0, Math.min(3, Math.floor((1 - tone) * 4)));
    const mix = Math.round(base * (1 - drive) + block * drive);
    return Math.max(0, Math.min(3, mix));
  }
  return base;
}

export function computeDraft(luma, ends, picks, structureId, opts = {}) {
  const s = STRUCTURES[structureId];
  if (!s) throw new RangeError("unknown structure: " + structureId);
  const drive = Math.max(0, Math.min(1, opts.toneDrive === undefined ? 0.6 : opts.toneDrive));
  const threading = new Array(ends);
  for (let e = 0; e < ends; e++) threading[e] = s.threading(e);
  const pickTone = new Float32Array(picks);
  for (let p = 0; p < picks; p++) {
    let m = 0;
    for (let e = 0; e < ends; e++) m += luma[p * ends + e];
    pickTone[p] = m / ends;
  }
  const treadling = new Array(picks);
  for (let p = 0; p < picks; p++) treadling[p] = toneTreadle(structureId, s, p, pickTone[p], drive);
  // liftedByTreadle[t] is a boolean per shaft, from the tieup.
  const liftedByTreadle = s.tieup.map((shafts) => {
    const row = new Array(s.shafts).fill(false);
    for (const sh of shafts) row[sh] = true;
    return row;
  });
  // Per-cell lift for the jacquard mode: tone picks the riser count of the
  // inclusive set. Cell is a riser when its offset from the pick's satin
  // anchor is below the tonal level; drive 0 collapses to the flat 1/7 base.
  const cellLift = (e, p) => {
    const tone = luma[p * ends + e];
    const level = Math.max(1, Math.min(7, Math.round(1 + tone * 6 * drive)));
    return ((e - p * 3) % 8 + 8) % 8 < level;
  };
  return {
    ends, picks, structureId,
    shafts: s.shafts, treadles: s.treadles, perCell: !!s.perCell,
    threading, treadling, tieup: liftedByTreadle,
    liftAt: s.perCell ? cellLift : (e, p) => liftedByTreadle[treadling[p]][threading[e]],
    lumaAt: (e, p) => luma[p * ends + e],
    pickTone,
  };
}

const hex2rgb = (h) => {
  const v = parseInt(h.replace("#", ""), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};
const rgb2hex = (r, g, b) =>
  "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
const lumaOf = (rgb) => (rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114) / 255;

// Weft palette: "image" quantizes mean row colors into up to 8 tone buckets;
// a fixed array maps each row to its nearest palette color by luminance.
export function weftPaletteFor(draft, sampler, mode) {
  const rows = seq(draft.picks).map((p) => sampler(p));
  if (Array.isArray(mode)) {
    const pal = mode.map(hex2rgb);
    const idx = rows.map((rgb) => {
      const t = lumaOf(rgb);
      let best = 0, dist = 2;
      pal.forEach((c, i) => { const d = Math.abs(lumaOf(c) - t); if (d < dist) { dist = d; best = i; } });
      return best;
    });
    return { hexes: mode.slice(), indexAt: (p) => idx[p] };
  }
  const K = Math.min(8, Math.max(2, Math.round(Math.sqrt(draft.picks / 3))));
  const order = seq(draft.picks).sort((a, b) => lumaOf(rows[a]) - lumaOf(rows[b]));
  const bucketOf = new Array(draft.picks);
  const sums = Array.from({ length: K }, () => [0, 0, 0, 0]);
  order.forEach((p, rank) => {
    const b = Math.min(K - 1, Math.floor((rank / draft.picks) * K));
    bucketOf[p] = b;
    const s = sums[b];
    s[0] += rows[p][0]; s[1] += rows[p][1]; s[2] += rows[p][2]; s[3]++;
  });
  const hexes = sums.map((s) => (s[3] ? rgb2hex(s[0] / s[3], s[1] / s[3], s[2] / s[3]) : "#808080"));
  return { hexes, indexAt: (p) => bucketOf[p] };
}

// WIF 1.1 writer. Informational sections first (single-pass reader order from
// the spec appendix), 1-based data lines, Range=0,255, Rising Shed, and both
// TREADLING and LIFTPLAN so dobby and table loom software load it directly.
// CRLF endings; notes kept out entirely (32-char importer fragility).
export function draftToWIF(draft, opts = {}) {
  const warpHex = opts.warpHex || "#e8e2d4";
  const weftHexes = (opts.weftHexes && opts.weftHexes.length ? opts.weftHexes : ["#14131a"]);
  const weftIndexAt = opts.weftIndexAt || (() => 0);
  const L = [];
  L.push("[WIF]", "Version=1.1", "Date=" + (opts.date || "April 20, 1997"),
    "Developers=wif@mhsoft.com", "Source Program=The Loom", "Source Version=1");
  L.push("[CONTENTS]", "Color Palette=yes", "Text=yes", "Weaving=yes", "Warp=yes", "Weft=yes",
    "Color Table=yes", "Threading=yes", "Tieup=yes", "Treadling=yes", "Liftplan=yes", "Weft colors=yes");
  L.push("[COLOR PALETTE]", "Entries=" + (1 + weftHexes.length), "Range=0,255");
  L.push("[TEXT]", "Title=" + (opts.title || "The Loom draft").slice(0, 60));
  L.push("[WEAVING]", "Shafts=" + draft.shafts, "Treadles=" + draft.treadles, "Rising Shed=yes");
  L.push("[WARP]", "Threads=" + draft.ends, "Color=1");
  L.push("[WEFT]", "Threads=" + draft.picks, "Color=2");
  L.push("[COLOR TABLE]");
  L.push("1=" + hex2rgb(warpHex).join(","));
  weftHexes.forEach((h, i) => L.push((i + 2) + "=" + hex2rgb(h).join(",")));
  L.push("[THREADING]");
  for (let e = 0; e < draft.ends; e++) L.push((e + 1) + "=" + (draft.threading[e] + 1));
  L.push("[TIEUP]");
  draft.tieup.forEach((row, t) => {
    const shafts = [];
    row.forEach((on, sh) => { if (on) shafts.push(sh + 1); });
    L.push((t + 1) + "=" + shafts.join(","));
  });
  L.push("[TREADLING]");
  for (let p = 0; p < draft.picks; p++) L.push((p + 1) + "=" + (draft.treadling[p] + 1));
  L.push("[LIFTPLAN]");
  for (let p = 0; p < draft.picks; p++) {
    const row = draft.tieup[draft.treadling[p]];
    const shafts = [];
    row.forEach((on, sh) => { if (on) shafts.push(sh + 1); });
    L.push((p + 1) + "=" + shafts.join(","));
  }
  L.push("[WEFT COLORS]");
  for (let p = 0; p < draft.picks; p++) L.push((p + 1) + "=" + (weftIndexAt(p) + 2));
  return L.join("\r\n") + "\r\n";
}

/* wifToDraft(text) -> { draft, colors, title } | null

   The reader the writer never had. Without it the WIF export was unverifiable:
   nothing could open one, so nothing could prove a round trip. A weaver can now
   bring in a draft from Fiberworks or WeaveIt, and the page can check its own
   export by re-reading it.

   Tolerant by design. Real WIF in the wild varies: section names in any case,
   comment lines, blank lines, CRLF or LF, keys out of order, and a file that
   carries a LIFTPLAN but no TIEUP (a table loom) or the reverse. Threading and
   treadling are 1-based in the file and 0-based here. */
export function wifToDraft(text) {
  if (typeof text !== "string" || !text.trim()) return null;
  const sec = {};
  let cur = null;
  const NL = String.fromCharCode(10);
  for (let raw of text.split(NL)) {
    const line = raw.trim();          // trim also drops a trailing CR
    if (!line || line[0] === ";" || line[0] === "#") continue;
    if (line[0] === "[" && line.indexOf("]") > 0) {
      cur = line.slice(1, line.indexOf("]")).trim().toUpperCase();
      sec[cur] = sec[cur] || {};
      continue;
    }
    if (!cur) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    sec[cur][line.slice(0, eq).trim().toUpperCase()] = line.slice(eq + 1).trim();
  }
  const weaving = sec.WEAVING || {};
  const num = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };
  const shafts = num(weaving.SHAFTS, 0);
  const treadles = num(weaving.TREADLES, 0);
  const ends = num((sec.WARP || {}).THREADS, 0);
  const picks = num((sec.WEFT || {}).THREADS, 0);
  if (!(shafts > 0 && ends > 0 && picks > 0)) return null;

  const threading = new Array(ends).fill(0);
  const th = sec.THREADING || {};
  for (const k in th) {
    const i = num(k, 0) - 1;
    if (i >= 0 && i < ends) threading[i] = Math.max(0, num(th[k], 1) - 1);
  }
  const tieup = [];
  const tu = sec.TIEUP || {};
  const tCount = Math.max(treadles, Object.keys(tu).length);
  for (let t = 0; t < tCount; t += 1) {
    const row = new Array(shafts).fill(false);
    const spec = tu[String(t + 1)];
    if (spec) for (const part of spec.split(",")) {
      const sh = num(part, 0) - 1;
      if (sh >= 0 && sh < shafts) row[sh] = true;
    }
    tieup.push(row);
  }
  const treadling = new Array(picks).fill(0);
  const tr = sec.TREADLING || {};
  const lift = sec.LIFTPLAN || {};
  if (Object.keys(tr).length) {
    for (const k in tr) {
      const i = num(k, 0) - 1;
      if (i >= 0 && i < picks) treadling[i] = Math.max(0, num(tr[k], 1) - 1);
    }
  } else if (Object.keys(lift).length) {
    // A liftplan file has no treadles: synthesise one treadle per distinct row.
    const key = (row) => row.map((b) => (b ? 1 : 0)).join("");
    const seen = new Map();
    tieup.length = 0;
    for (let p = 0; p < picks; p += 1) {
      const row = new Array(shafts).fill(false);
      const spec = lift[String(p + 1)];
      if (spec) for (const part of spec.split(",")) {
        const sh = num(part, 0) - 1;
        if (sh >= 0 && sh < shafts) row[sh] = true;
      }
      const k = key(row);
      if (!seen.has(k)) { seen.set(k, tieup.length); tieup.push(row); }
      treadling[p] = seen.get(k);
    }
  }
  if (!tieup.length) return null;

  const draft = {
    ends, picks, shafts,
    treadles: tieup.length,
    threading, tieup, treadling,
    liftAt: (e, p) => {
      const row = tieup[treadling[p]];
      return row && row[threading[e]] ? 1 : 0;
    },
  };
  const table = sec["COLOR TABLE"] || {};
  const toHex = (v) => {
    const p3 = String(v).split(",").map((n) => Math.max(0, Math.min(255, parseInt(n, 10) || 0)));
    return "#" + p3.slice(0, 3).map((n) => n.toString(16).padStart(2, "0")).join("");
  };
  const warpHex = table["1"] ? toHex(table["1"]) : "#e8e2d4";
  const weftHexes = Object.keys(table).filter((k) => k !== "1")
    .sort((a, b) => (+a) - (+b)).map((k) => toHex(table[k]));
  return {
    draft,
    colors: { warpHex, weftHexes: weftHexes.length ? weftHexes : ["#14131a"] },
    title: ((sec.TEXT || {}).TITLE || "imported draft").slice(0, 80),
  };
}
