// Reader for the generator's rasters (plain PGM, "P2"). The generator is BuildLang and writes text
// because its file writer takes strings only; this turns the text back into typed arrays for the
// page, the plate and the checks. Works on bytes, so it runs the same in node and in a browser.
//   parsePgm(Uint8Array) -> { width, height, max, data: Uint16Array }
export function parsePgm(bytes) {
  let i = 0;
  const n = bytes.length;
  const next = () => {
    while (i < n && bytes[i] <= 32) i++;
    let v = 0;
    while (i < n && bytes[i] > 32) v = v * 10 + bytes[i++] - 48;
    return v;
  };
  if (bytes[0] !== 80 || bytes[1] !== 50) throw new Error("pgm: not a P2 file");
  i = 2;
  const width = next(), height = next(), max = next();
  const data = new Uint16Array(width * height);
  for (let k = 0; k < data.length; k++) data[k] = next();
  if (i > n) throw new Error("pgm: file is short");
  return { width, height, max, data };
}

// metres from a height code (the generator stores (m + 512) * 16)
export const metres = (code) => code / 16 - 512;
export const HEIGHT_SCALE = 16, HEIGHT_BIAS = 512;
