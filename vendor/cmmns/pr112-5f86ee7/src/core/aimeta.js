// Metadata outside Content Credentials that says how a file was made: the IPTC digital source type
// in XMP, generator text that image tools write into PNG text chunks, and the EXIF Software and
// Artist fields. It reads only what the file states; a file can be stripped or relabelled, and
// most platforms strip all of this on upload.

import { mediaFormat, jpegSegments, pngChunks, riffChunks } from "./jumbf.js";

// IPTC NewsCodes digital source types (cv.iptc.org/newscodes/digitalsourcetype), in plain words.
export const SOURCE_TYPES = {
  trainedAlgorithmicMedia: ["made with generative AI", "ai"],
  compositeWithTrainedAlgorithmicMedia: ["includes generative AI elements", "ai"],
  algorithmicallyEnhanced: ["enhanced by an algorithm", "edit"],
  algorithmicMedia: ["made by an algorithm without training data", "synthetic"],
  compositeSynthetic: ["a composite with synthetic elements", "synthetic"],
  digitalArt: ["digital art made by a person", "art"],
  digitalCapture: ["captured by a camera or recorder", "capture"],
  computationalCapture: ["captured with computational processing", "capture"],
  compositeCapture: ["a composite of captured elements", "capture"],
  screenCapture: ["a screen capture", "capture"],
  virtualRecording: ["a recording of a virtual scene", "synthetic"],
  negativeFilm: ["scanned from negative film", "capture"], positiveFilm: ["scanned from positive film", "capture"],
  print: ["scanned from a print", "capture"], humanEdits: ["edited by a person", "edit"], minorHumanEdits: ["minor edits by a person", "edit"],
  dataDrivenMedia: ["generated from data", "synthetic"], composite: ["a composite", "edit"],
};

// "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia" -> { code, says, kind }
export function sourceType(uri) {
  const code = String(uri || "").split("/").pop();
  const t = SOURCE_TYPES[code];
  return t ? { code, says: t[0], kind: t[1] } : code ? { code, says: code, kind: "other" } : null;
}

// Names of image and video generators that tools write into metadata. Case-insensitive.
const GENERATORS = /\b(midjourney|dall[-·. ]?e|stable diffusion|sdxl|adobe firefly|firefly|imagen|gemini|made with google ai|novelai|leonardo\.?ai|ideogram|flux(?:\.1)?|comfyui|automatic1111|invokeai|bing image creator|microsoft designer|sora|runway|pika|kling|veo|dreamstudio|nightcafe|playground ai|krea)\b/i;
const PNG_GEN_KEYS = new Set(["parameters", "prompt", "workflow", "invokeai_metadata", "sd-metadata", "dream", "generation_data"]);

const latin1 = (b) => { let s = ""; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192)); return s; };
const utf8 = (b) => new TextDecoder().decode(b);

// Text blocks in the file's metadata: [{ kind: "xmp"|"exif"|"text"|"comment", key, text }].
export function metadataBlocks(b) {
  const f = mediaFormat(b), out = [];
  if (f === "jpeg") {
    for (const s of jpegSegments(b)) {
      const head = latin1(s.data.subarray(0, 40));
      if (s.marker === 0xe1 && head.startsWith("http://ns.adobe.com/xap/1.0/\0")) out.push({ kind: "xmp", text: utf8(s.data.subarray(29)) });
      else if (s.marker === 0xe1 && head.startsWith("Exif\0")) out.push(...exifText(s.data.subarray(6)));
      else if (s.marker === 0xfe) out.push({ kind: "comment", text: utf8(s.data) });
    }
  } else if (f === "png") {
    for (const c of pngChunks(b)) {
      if (c.type === "tEXt" || c.type === "iTXt") {
        const z = c.data.indexOf(0), key = latin1(c.data.subarray(0, z));
        let body = c.data.subarray(z + 1);
        if (c.type === "iTXt") { if (body[0]) continue; let k = 2; for (let n = 0; n < 2; n++) k = body.indexOf(0, k) + 1; body = body.subarray(k); }
        out.push(key === "XML:com.adobe.xmp" ? { kind: "xmp", text: utf8(body) } : { kind: "text", key, text: utf8(body) });
      } else if (c.type === "eXIf") out.push(...exifText(c.data));
    }
  } else if (f === "webp") {
    for (const c of riffChunks(b)) {
      if (c.type === "XMP ") out.push({ kind: "xmp", text: utf8(c.data) });
      else if (c.type === "EXIF") out.push(...exifText(c.data[0] === 0x45 ? c.data.subarray(6) : c.data));
    }
  }
  return out;
}

const EXIF_TAGS = { 0x010e: "ImageDescription", 0x010f: "Make", 0x0110: "Model", 0x0131: "Software", 0x013b: "Artist" };

// The text fields of EXIF IFD0 that name a device, a tool or an author.
function exifText(t) {
  try {
    const le = t[0] === 0x49, r16 = (i) => (le ? t[i] | (t[i + 1] << 8) : (t[i] << 8) | t[i + 1]);
    const r32 = (i) => (le ? (t[i] | (t[i + 1] << 8) | (t[i + 2] << 16)) + t[i + 3] * 16777216 : t[i] * 16777216 + ((t[i + 1] << 16) | (t[i + 2] << 8) | t[i + 3]));
    const ifd = r32(4), n = r16(ifd), out = [];
    for (let k = 0; k < n && k < 200; k++) {
      const e = ifd + 2 + k * 12, tag = r16(e), type = r16(e + 2), count = r32(e + 4);
      if (!EXIF_TAGS[tag] || type !== 2) continue;
      const at = count <= 4 ? e + 8 : r32(e + 8);
      const s = utf8(t.subarray(at, at + count)).replace(/\0+$/, "").trim();
      if (s) out.push({ kind: "exif", key: EXIF_TAGS[tag], text: s.slice(0, 200) });
    }
    return out;
  } catch { return []; }
}

// What the metadata says about how the file was made: { sourceTypes, generators, fields, any, remote },
// where remote is the address of Content Credentials stored online (XMP dcterms:provenance).
export function aiMetadata(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const blocks = metadataBlocks(b), types = new Map(), gens = new Set(), fields = [];
  let remote = null;
  for (const k of blocks) {
    if (k.kind === "xmp") {
      for (const m of k.text.matchAll(/DigitalSourceType(?:="|>)\s*([^"<\s]+)/g)) { const t = sourceType(m[1]); if (t) types.set(t.code, t); }
      const prov = k.text.match(/dcterms:provenance(?:="|>)\s*(https?:\/\/[^"<\s]+)/);
      if (prov) remote = prov[1];
      for (const m of k.text.matchAll(/(?:xmp:CreatorTool|tiff:Software)(?:="|>)([^"<]{1,120})/g)) fields.push({ key: "Creator tool (XMP)", text: m[1].trim() });
    }
    if (k.kind === "text" && PNG_GEN_KEYS.has(k.key.toLowerCase())) gens.add(`PNG text "${k.key}" holds image-generator settings`);
    if (k.kind === "exif" || (k.kind === "text" && /^(software|source|comment|description)$/i.test(k.key))) fields.push({ key: k.key, text: k.text.slice(0, 160) });
    const g = k.text.match(GENERATORS);
    if (g && k.kind !== "xmp") gens.add(`${k.key || k.kind} names ${g[1]}`);
  }
  return { sourceTypes: [...types.values()], generators: [...gens], fields: fields.slice(0, 6), any: blocks.length > 0, remote };
}
