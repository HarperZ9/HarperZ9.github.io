// bus-kernel.mjs: the pure kernel of the exchange bus. It mirrors src/bus_kernel.bld function for function; that
// file is the source of record, and bus.test.mjs compares this module against src/bus_kernel.expected, the output
// of the BuildLang program.

// One FNV-1a pass over bytes from a chosen offset basis, modulo 2^32.
export function fnv1a(bytes, n, basis) {
  let h = basis >>> 0;
  for (let i = 0; i < n; i++) h = Math.imul(h ^ (bytes[i] & 255), 16777619) >>> 0;
  return h;
}
export const sessionHi = (bytes, n) => fnv1a(bytes, n, 2166136261);
export const sessionLo = (bytes, n) => fnv1a(bytes, n, 3339675911);
const hex8 = (x) => x.toString(16).padStart(8, '0');
// The 16 hex digits of a session id, from the bytes of a value's canonical text.
export const sessionHash = (bytes) => hex8(sessionHi(bytes, bytes.length)) + hex8(sessionLo(bytes, bytes.length));
