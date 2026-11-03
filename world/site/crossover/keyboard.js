// A colour keyboard after Le Corbusier's Polychromie (1931/1959), whose keys group colours by what they do in space:
// sky recedes, sand holds, landscape advances, velvet encloses. Here each key is dissected into the five inks measured
// from the Olivetti "De A a Z" print (tables.js): a key's absorbance spectrum is a weighted sum of measured ones, so
// its colour, and every overlap it makes with another key, is computed per wavelength rather than picked.
// In a tool's mark the role follows the mechanism: what arrives is sky, what is held or recorded is sand, what the
// tool does or returns is landscape (red for a stop or a flag, green for a pass or a fix), and a boundary is velvet.
import { INKS } from "./tables.js";

export const KEYS = {
  sky: { role: "sky", recedes: true, mix: { cyan: 0.42 } },
  mist: { role: "sky", recedes: true, mix: { cyan: 0.2, yellow: 0.06 } },
  sand: { role: "sand", mix: { yellow: 0.55, red: 0.1 } },
  straw: { role: "sand", mix: { yellow: 0.32, red: 0.03, cyan: 0.04 } },
  land: { role: "landscape", mix: { red: 0.95 } },
  leaf: { role: "landscape", mix: { green: 0.9 } },
  velvet: { role: "velvet", mix: { red: 0.5, cyan: 0.38, yellow: 0.08 } },
};

// the absorbance spectrum of a key over the 16 bins: the sum of its measured inks, each scaled by its weight
export function keySpectrum(name) {
  const k = KEYS[name]; if (!k) throw new Error(`colour keyboard: no key "${name}"`);
  const out = new Array(16).fill(0);
  for (const [ink, w] of Object.entries(k.mix)) INKS[ink].forEach((v, b) => { out[b] += w * v; });
  return out;
}
