// lib/zlib.js: zlib deflate and inflate with no dependency. Node uses its built-in zlib; the browser uses the
// native CompressionStream ('deflate' is the zlib format PNG needs). Both are async so one API serves both.
const isNode = typeof process !== 'undefined' && !!process.versions?.node && typeof window === 'undefined';

async function stream(kind, bytes, fmt) {
  const s = new Blob([bytes]).stream().pipeThrough(kind === 'c' ? new CompressionStream(fmt) : new DecompressionStream(fmt));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

export async function deflate(bytes, level = 9) {
  if (isNode) { const z = await import('node:zlib'); return new Uint8Array(z.deflateSync(bytes, { level })); }
  return stream('c', bytes, 'deflate');
}
export async function inflate(bytes) {
  if (isNode) { const z = await import('node:zlib'); return new Uint8Array(z.inflateSync(bytes)); }
  return stream('d', bytes, 'deflate');
}
