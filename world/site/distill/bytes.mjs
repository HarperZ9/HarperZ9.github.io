// Distill: small byte readers shared by every format reader. Each one throws on a read past the end, so a
// truncated or malformed file ends a reader with a plain message.
const need = (b, o, n) => { if (o < 0 || o + n > b.length) throw new Error(`a field at byte ${o} runs past the end of the file`); };
export const u8 = (b, o) => { need(b, o, 1); return b[o]; };
export const u16le = (b, o) => { need(b, o, 2); return b[o] | (b[o + 1] << 8); };
export const u16be = (b, o) => { need(b, o, 2); return (b[o] << 8) | b[o + 1]; };
export const u32le = (b, o) => { need(b, o, 4); return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; };
export const u32be = (b, o) => { need(b, o, 4); return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0; };
export const u64le = (b, o) => u32le(b, o) + u32le(b, o + 4) * 4294967296;
export const u64be = (b, o) => u32be(b, o) * 4294967296 + u32be(b, o + 4);
export const ascii = (b, o, n) => { need(b, o, n); let s = ""; for (let i = 0; i < n; i++) s += String.fromCharCode(b[o + i]); return s; };
export const starts = (b, sig, o = 0) => { if (o + sig.length > b.length) return false; for (let i = 0; i < sig.length; i++) if (b[o + i] !== (typeof sig === "string" ? sig.charCodeAt(i) : sig[i])) return false; return true; };
export const utf8 = (b, o, n) => { need(b, o, n); return new TextDecoder("utf-8").decode(b.subarray(o, o + n)); };
export const part = (name, kind, offset, length, facts) => (facts ? { name, kind, offset, length, facts } : { name, kind, offset, length });
// search backwards for a byte signature, within a window
export function lastIndexOf(b, sig, from = b.length - sig.length, floor = 0) {
  for (let i = Math.min(from, b.length - sig.length); i >= floor; i--) if (starts(b, sig, i)) return i;
  return -1;
}
// consecutive parts of one kind fold into a single part, so 400 data chunks read as one line
export function fold(parts, kind, label) {
  const out = [];
  for (const p of parts) {
    const last = out[out.length - 1];
    if (p.kind === kind && last && last.kind === kind && last.offset + last.length === p.offset) { last.length += p.length; last.count = (last.count || 1) + 1; last.name = label(last.count); }
    else out.push({ ...p });
  }
  return out;
}
export const secs = (s) => +s.toFixed(3);
