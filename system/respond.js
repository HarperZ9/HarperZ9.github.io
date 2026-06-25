// respond.js: pure, zero-dep, node-testable.
// respond(message, ctx, history?) -> string
//
// ctx shape:
//   phash          string, 64-bit perceptual hash hex
//   features       { contrast, entropy, balance }, gated scalar metrics 0-1
//   dominantColors [hex, ...], up to 3 dominant colour hex strings
//   hueName        string, plain colour name ("teal", "red", "grey", ...)
//   edgeDensity    number 0-1, fraction of interior pixels with strong edges
//   motion         number, Hamming distance / 64 for latest frame-to-frame Δ (0 = still)
//   audio          { level, pitch } | null, RMS level 0-1, pitch Hz; null = no audio
//   sourceName     string, one of "Atelier", "2D fractal", "3D fractal", "your media", "screen/camera"
//   width          number
//   height         number
//
// history shape: Array<{ q: string, a: string, phash?: string }>, last few exchanges
//
// Pure: no DOM reads, no side effects.
// NEVER puts `message` into HTML; callers use .textContent.

// Intents the grounded responder cannot fulfil; declines honestly.
const DECLINE_INTENTS = [
  /\bjoke\b/,
  /\bstory\b/,
  /\briddle\b/,
  /\bweather\b/,
  /\bcalculate?\b/,
  /\bmath\b/,
  /\bwho is\b/,
  /what is the (?:time|date|news)\b/,
];

export function respond(message, ctx, history = []) {
  // Safety: always return a non-empty string even with a degenerate ctx.
  if (!ctx || !ctx.phash || ctx.phash === "—") {
    return "Nothing loaded yet. Pick a source and generate or drop a frame, then ask me what I see.";
  }

  const s = (message || "").toLowerCase();
  const ask = (...keywords) => keywords.some(w => s.includes(w));

  // ── pull named values safely ──────────────────────────────────────────────
  const con    = typeof ctx.features?.contrast === "number" ? ctx.features.contrast : null;
  const str    = typeof ctx.features?.entropy  === "number" ? ctx.features.entropy  : null;
  const bal    = typeof ctx.features?.balance  === "number" ? ctx.features.balance  : null;
  const edge   = typeof ctx.edgeDensity        === "number" ? ctx.edgeDensity        : null;
  const motion = typeof ctx.motion             === "number" ? ctx.motion             : 0;
  const colors = Array.isArray(ctx.dominantColors) ? ctx.dominantColors.slice(0, 3) : [];
  const hue    = ctx.hueName || "unknown";
  const src    = ctx.sourceName || "frame";
  const phash  = ctx.phash;
  const w      = ctx.width  || 0;
  const h      = ctx.height || 0;
  const audio  = ctx.audio || null;

  // ── history: detect frame change since last exchange ──────────────────────
  const prevPhash = Array.isArray(history) && history.length > 0
    ? history[history.length - 1].phash || null
    : null;
  const phashChanged = prevPhash && prevPhash !== phash;
  const changePrefix = phashChanged ? "The frame has shifted since then. " : "";

  // ── helpers for varied phrasing based on measured thresholds ─────────────
  const f2 = n => (typeof n === "number" ? n.toFixed(2) : "—");

  function contrastWord(v) {
    if (v === null) return "unknown";
    if (v > 0.72) return "high";
    if (v > 0.48) return "moderate";
    return "low";
  }
  function structureWord(v) {
    if (v === null) return "unknown";
    if (v > 0.82) return "very richly textured";
    if (v > 0.62) return "moderately detailed";
    if (v > 0.42) return "fairly simple";
    return "minimal";
  }
  function edgeWord(v) {
    if (v === null) return "unknown edge density";
    if (v > 0.25) return "dense edges";
    if (v > 0.10) return "moderate edges";
    return "soft, low-edge";
  }
  function motionLine() {
    const delta = Math.round(motion * 64);
    if (delta === 0) return "holding still";
    if (delta < 5)  return `barely shifting (Δ${delta}/64)`;
    if (delta < 20) return `moving gently (Δ${delta}/64)`;
    return `moving a lot (Δ${delta}/64)`;
  }
  function colorLine() {
    const cStr = colors.join(", ");
    return cStr
      ? `${hue}-dominant (${cStr})`
      : `${hue}-leaning`;
  }
  function snapSummary() {
    return `${contrastWord(con)} contrast (${f2(con)}), ${colorLine()}, ${edgeWord(edge)}, ${motionLine()}`;
  }

  // ── honest declines for things this layer cannot do ───────────────────────
  // Check BEFORE routing so "tell me a joke about colours" doesn't slip through to colour intent.
  if (DECLINE_INTENTS.some(re => re.test(s))) {
    return `I can't do that. I'm the perception layer here, not a language model. `
      + `But I can tell you exactly what I'm seeing right now: ${colorLine()}, ${motionLine()}, hash ${phash}. `
      + `Ask me about colours, contrast, motion, or structure, or connect a real model for open-ended reasoning.`;
  }

  // ── intent classification + grounded response ────────────────────────────

  // colour / hue / palette: leads with colour
  if (ask("colour", "color", "hue", "palette", "tint", "shade")) {
    const cStr = colors.join(", ");
    if (!cStr) return `${changePrefix}I'm not reading a strong colour cluster right now; the frame is mostly ${hue}. Fingerprint: ${phash}.`;
    const conText = con !== null
      ? ` The contrast is ${contrastWord(con)} (${f2(con)}), so the palette ${con > 0.6 ? "has strong separation" : "blends together"}.`
      : "";
    return `${changePrefix}Dominant colours: ${cStr}. It reads as ${hue}-dominant.${conText} Fingerprint: ${phash}.`;
  }

  // motion / movement: leads with motion
  if (ask("motion", "move", "moving", "still", "static", "animate", "change")) {
    const delta = Math.round(motion * 64);
    if (delta === 0) {
      return `${changePrefix}Completely still: zero frame-to-frame change (Δ0/64). The hash is locked at ${phash}. Source: ${src}.`;
    }
    return `${changePrefix}It's moving: Δ${delta}/64 since the last measured frame, ${motionLine()}. Current hash ${phash} on a ${colorLine()} frame.`;
  }

  // structure / detail / busy / texture / complexity
  if (ask("structure", "detail", "busy", "complex", "texture", "noise", "pattern")) {
    const sw = structureWord(str);
    const ew = edge !== null ? `, with ${edgeWord(edge)} (${f2(edge)})` : "";
    const mv = motionLine();
    return `${changePrefix}Structure (entropy): ${f2(str)}, ${sw}${ew}. Right now it's ${mv}. Source: ${src} at ${w}×${h}.`;
  }

  // contrast / light / dark / bright
  if (ask("contrast", "bright", "dark", "light", "tone", "exposure", "luminance")) {
    const cw = contrastWord(con);
    const luma = typeof ctx.features?.balance === "number"
      ? ` The tonal balance is ${f2(bal)}.`
      : "";
    return `${changePrefix}Contrast is ${f2(con)}, ${cw}.${luma} It's ${colorLine()}, ${motionLine()}. Hash: ${phash}.`;
  }

  // audio / sound / loud / quiet / music / pitch
  if (ask("audio", "sound", "loud", "quiet", "music", "pitch", "hear", "listen")) {
    if (!audio) {
      return `No audio channel is attached right now; I only have the visual signal. Visually: ${snapSummary()}. Fingerprint: ${phash}.`;
    }
    const lvl = audio.level;
    const hz  = audio.pitch;
    const loudWord = lvl > 0.5 ? "loud" : lvl > 0.15 ? "moderate" : lvl > 0.02 ? "quiet" : "nearly silent";
    const pitchWord = hz > 2000 ? "high-pitched" : hz > 500 ? "mid-range" : "low-pitched";
    return `Audio level: ${lvl.toFixed(3)} (${loudWord}), dominant pitch ~${Math.round(hz)} Hz (${pitchWord}). Visual context: ${colorLine()}, ${contrastWord(con)} contrast. Fingerprint: ${phash}.`;
  }

  // why / how do you know / trust / prove / honest / evidence: grounding explanation
  if (ask("why", "how do you know", "trust", "prove", "honest", "evidence", "grounded")) {
    return `Every word I say is a number you can re-derive. I read the ${src} frame pixel-by-pixel: hash ${phash}, ${snapSummary()}. The meters on the measurimeter are exactly what I'm given, nothing invented.`;
  }

  // "what is this" / "about" / "describe" / "what do you see" / "look at" / "see"
  if (ask("what is", "what's", "about", "describe", "see", "look", "this", "tell me")) {
    const sw = str !== null ? `, ${structureWord(str)} in structure` : "";
    // Reference prior exchange if frame changed
    const historyNote = phashChanged
      ? ` (the hash moved from ${prevPhash} to ${phash}, so something changed)`
      : history.length > 0 ? " (same frame as before)" : "";
    return `${changePrefix}I'm looking at a ${w}×${h} ${src} frame: ${colorLine()}${sw}, ${edgeWord(edge)}, ${motionLine()}. Contrast: ${f2(con)}. Fingerprint: ${phash}${historyNote}.`;
  }

  // balance / symmetry / centred
  if (ask("balance", "symmetr", "centre", "center", "compos")) {
    return bal !== null
      ? `${changePrefix}Balance (mass distribution around centre): ${f2(bal)}. ${bal > 0.7 ? "Well centred." : bal > 0.45 ? "Slightly off-centre." : "Weight skews to one side."} Context: ${colorLine()}, ${contrastWord(con)} contrast.`
      : `I don't have a balance reading for this frame yet. Current hash: ${phash}.`;
  }

  // hash / fingerprint / id / drift
  if (ask("hash", "fingerprint", "id", "drift", "same", "differ")) {
    const delta = Math.round(motion * 64);
    const driftLine = delta > 0 ? ` Last frame-to-frame shift: Δ${delta}/64.` : " No frame-to-frame shift detected.";
    return `Perceptual fingerprint: ${phash}.${driftLine} If anything changes on the canvas, the hash moves, and that's how I know something happened. Source: ${src}.`;
  }

  // size / dimensions / resolution
  if (ask("size", "dimension", "resolution", "pixel", "big", "small", "wide", "tall")) {
    const orient = w > h ? "landscape" : w < h ? "portrait" : "square";
    return `The frame is ${w}×${h}, ${orient}. I downsample it to a faithful mosaic for measurement. Source: ${src}. Hash: ${phash}.`;
  }

  // what can we try / next / suggest / idea / make / could / explore
  if (ask("try", "next", "idea", "make", "could", "suggest", "explore", "experiment", "what can")) {
    const axes = [
      ["contrast", con],
      ["structure", str],
      ["balance", bal],
    ].filter(([, v]) => v !== null);
    let weak = "contrast", lo = Infinity;
    for (const [k, v] of axes) if (v < lo) { lo = v; weak = k; }
    const loStr = lo < Infinity ? f2(lo) : "—";
    return `The readout shows ${snapSummary()}. ${weak} (${loStr}) has the most headroom, so try a transform to push it. Or swap the source, change the palette, and watch what the hash does.`;
  }

  // ── honest grounded fallback for ANY unmatched/off-topic input ─────────────
  // Vary phrasing by history depth to avoid sounding repetitive.
  const delta = Math.round(motion * 64);
  const audioNote = audio
    ? ` Audio level: ${audio.level.toFixed(3)}.`
    : "";
  const alt = Array.isArray(history) && history.length % 2 === 1;
  if (alt) {
    return `${changePrefix}Right now I'm reading ${snapSummary()}.${audioNote} What would you like to know: colour, contrast, structure, motion${audio ? ", audio" : ""}, or what we could try? Hash: ${phash}.`;
  }
  return `${changePrefix}I can only speak to what I'm measuring right now: ${snapSummary()}.${audioNote} Ask me about its colour, contrast, structure, motion${audio ? ", audio" : ""}, or what we could try with it. Hash: ${phash}.`;
}
