// Site identity is deliberately independent of the foundry's product inventory.
export const SITE_PAIRING = [
  { id: 'hanken', label: 'Hanken Grotesk', stack: '"Hanken Grotesk", sans-serif', poster: true, css: true },
  { id: 'conso', label: 'Conso', stack: '"Conso", serif', poster: true, css: true },
];

const PRINTABLE_ASCII = Array.from({ length: 95 }, (_, index) => index + 32);
const EDITORIAL_PREVIEW_COVERAGE = [
  ...PRINTABLE_ASCII,
  160, 176, 177, 215, 247, 8211, 8212, 8216, 8217, 8220, 8221, 8226, 8230, 8722,
];
const MONO_LATIN_PREVIEW_COVERAGE = [
  32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47,
  48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63,
  64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79,
  80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95,
  96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109,
  110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122,
  123, 124, 125, 126, 160, 176, 177, 192, 193, 194, 195, 196, 197,
  199, 200, 201, 202, 203, 204, 205, 206, 207, 209, 210, 211, 212,
  213, 214, 215, 217, 218, 219, 220, 221, 224, 225, 226, 227, 228,
  229, 231, 232, 233, 234, 235, 236, 237, 238, 239, 241, 242, 243,
  244, 245, 246, 247, 249, 250, 251, 252, 253, 255, 305, 376, 768,
  769, 770, 771, 776, 778, 807, 8211, 8212, 8216, 8217, 8220, 8221,
  8226, 8230, 8722,
];

// Public, reviewed preview records only. Private studies and planned families
// are not inventory. New styles belong to their family, not a new product.
export const ORIGINAL_FAMILIES = [{
  id: 'editorial',
  name: 'Zentropy Editorial',
  classification: 'High-contrast serif',
  status: 'development-preview',
  styles: [{
    id: 'editorial-preview',
    label: 'Zentropy Editorial Preview',
    style: 'Regular',
    stack: '"Zentropy Editorial Preview", Georgia, serif',
    metadata: 'type/preview/editorial.json',
    coverage: EDITORIAL_PREVIEW_COVERAGE,
  }],
}, {
  id: 'mono',
  name: 'Zentropy Mono',
  classification: 'Fixed-pitch text',
  status: 'development-preview',
  styles: [{
    id: 'mono-preview',
    label: 'Zentropy Mono Preview',
    style: 'Regular',
    stack: '"Zentropy Mono Preview", monospace',
    metadata: 'type/preview/mono.json',
    coverage: MONO_LATIN_PREVIEW_COVERAGE,
  }],
}];

export function specimenFamilies(pairing, families) {
  const faces = Object.create(null);
  const familyIds = new Set();
  function add(id, face) {
    if (Object.hasOwn(faces, id)) throw new Error(`Duplicate specimen id: ${id}`);
    faces[id] = face;
  }
  for (const face of pairing) add(face.id, { ...face });
  for (const family of families) {
    if (familyIds.has(family.id)) throw new Error(`Duplicate family id: ${family.id}`);
    familyIds.add(family.id);
    for (const style of family.styles) {
      add(style.id, {
        ...style, familyId: family.id, preview: true,
        coverage: new Set(style.coverage),
        // Product inventory never grants export or purchase rights. Releases
        // need a separate reviewed license and delivery integration.
        poster: false, css: false,
      });
    }
  }
  return faces;
}
