// Copied unmodified below this header from Daylight Commons (provenance-badges, branch feat/media-toolkit,
// commit 37b80eef14ca1f13e888749f0049437e2b647966, src/core/media-gif-lzw.js). Same author; licence FSL-1.1-MIT.
// Used read-only by the alive layer's gif.js for decoding. Fix bugs upstream, then copy again.
// The GIF variant of LZW decompression: variable code size from minCodeSize + 1 up to 12 bits,
// clear and end-of-information codes, and the deferred-clear case when the table is full.

const MAX_CODES = 4096;

// Writes the string for `code` into out, ending at index end - 1, clipped to out.length.
function emit(out, code, start, length, prefix, suffix) {
  let c = code;
  for (let k = start + length - 1; k >= start; k--) {
    if (k < out.length) out[k] = suffix[c];
    c = prefix[c];
  }
}

function tables(minCodeSize) {
  const t = {
    prefix: new Int16Array(MAX_CODES), suffix: new Uint8Array(MAX_CODES),
    first: new Uint8Array(MAX_CODES), length: new Uint16Array(MAX_CODES),
  };
  for (let i = 0; i < 1 << minCodeSize; i++) {
    t.prefix[i] = -1;
    t.suffix[i] = i;
    t.first[i] = i;
    t.length[i] = 1;
  }
  return t;
}

// Decodes up to pixelCount colour indices. Missing data leaves the rest of the frame at 0.
export function gifLzwDecode(data, minCodeSize, pixelCount) {
  if (!(minCodeSize >= 1 && minCodeSize <= 11)) throw new Error("decodeGif: bad LZW minimum code size");
  const out = new Uint8Array(pixelCount);
  const { prefix, suffix, first, length } = tables(minCodeSize);
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  let codeSize = minCodeSize + 1;
  let next = eoi + 1;
  let prev = -1;
  let bits = 0, nbits = 0, pos = 0, op = 0;
  while (op < pixelCount) {
    while (nbits < codeSize) {
      if (pos >= data.length) return out;
      bits |= data[pos++] << nbits;
      nbits += 8;
    }
    const code = bits & ((1 << codeSize) - 1);
    bits >>>= codeSize;
    nbits -= codeSize;
    if (code === clear) {
      codeSize = minCodeSize + 1;
      next = eoi + 1;
      prev = -1;
      continue;
    }
    if (code === eoi) break;
    if (prev === -1) {
      if (code > clear) break;
      out[op++] = code;
      prev = code;
      continue;
    }
    if (code > next) break;
    if (next < MAX_CODES) {
      prefix[next] = prev;
      first[next] = first[prev];
      suffix[next] = code < next ? first[code] : first[prev];
      length[next] = length[prev] + 1;
      next++;
      if (next === 1 << codeSize && codeSize < 12) codeSize++;
    }
    emit(out, code, op, length[code], prefix, suffix);
    op += length[code];
    prev = code;
  }
  return out;
}
