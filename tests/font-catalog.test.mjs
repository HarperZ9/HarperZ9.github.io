import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync } from 'node:fs';

const moduleURL = new URL('../system/font-catalog.mjs', import.meta.url);

const EDITORIAL_COVERAGE = [
  ...Array.from({ length: 95 }, (_, index) => index + 32),
  160, 176, 177, 215, 247, 8211, 8212, 8216, 8217, 8220, 8221, 8226, 8230, 8722,
];
const MONO_LATIN_COVERAGE = [
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

test('the specimen catalog keeps the site pairing separate from original families', async () => {
  assert.ok(existsSync(moduleURL), 'A shared multi-family catalog is required');
  const { SITE_PAIRING, ORIGINAL_FAMILIES, specimenFamilies } = await import(moduleURL);
  assert.deepEqual(SITE_PAIRING.map(face => face.id), ['hanken', 'conso']);
  assert.equal(ORIGINAL_FAMILIES.length, 2, 'Only two reviewed original previews belong in the catalog');
  const originalById = Object.fromEntries(ORIGINAL_FAMILIES.map(family => [family.id, family]));
  assert.equal(originalById.editorial.status, 'development-preview');
  assert.equal(originalById.mono.status, 'development-preview');
  assert.equal(originalById.editorial.styles[0].style, 'Regular');
  assert.equal(originalById.mono.styles[0].style, 'Regular');
  assert.deepEqual(originalById.editorial.styles[0].coverage, EDITORIAL_COVERAGE);
  assert.equal(originalById.editorial.styles[0].coverage.length, 109);
  assert.deepEqual(originalById.mono.styles[0].coverage, MONO_LATIN_COVERAGE);
  assert.equal(originalById.mono.styles[0].coverage.length, 171);
  const faces = specimenFamilies(SITE_PAIRING, ORIGINAL_FAMILIES);
  assert.equal(faces['editorial-preview'].preview, true);
  assert.equal(faces['editorial-preview'].poster, false);
  assert.equal(faces['editorial-preview'].css, false);
  assert.equal(faces['editorial-preview'].coverage.has(233), false);
  assert.equal(faces['editorial-preview'].coverage.has(65), true);
  assert.equal(faces.hanken.poster, true);
  assert.equal(faces['mono-preview'].preview, true);
  assert.equal(faces['mono-preview'].poster, false);
  assert.equal(faces['mono-preview'].css, false);
  assert.equal(faces['mono-preview'].coverage.size, 171);
  assert.equal(faces['mono-preview'].coverage.has(233), true);
  assert.equal(faces['mono-preview'].coverage.has(778), true);
  assert.equal(faces['mono-preview'].coverage.has(0x4E2D), false);
  assert.notEqual(faces['mono-preview'].stack, faces['editorial-preview'].stack);
});

test('twenty original families and their styles do not expand the site pairing', async () => {
  assert.ok(existsSync(moduleURL), 'A shared multi-family catalog is required');
  const { SITE_PAIRING, ORIGINAL_FAMILIES, specimenFamilies } = await import(moduleURL);
  // Synthetic inventory tests scale only; these are never public product records.
  const families = Array.from({ length: 20 }, (_, i) => ({
    ...ORIGINAL_FAMILIES[0], id: `fixture-${i}`, name: `Fixture ${i}`,
    styles: ['regular', 'italic'].map(style => ({
      ...ORIGINAL_FAMILIES[0].styles[0], id: `fixture-${i}-${style}`,
    })),
  }));
  const faces = specimenFamilies(SITE_PAIRING, families);
  assert.equal(Object.keys(faces).length, 42);
  assert.equal(SITE_PAIRING.length, 2);
  assert.ok(faces['fixture-19-italic']);
  assert.equal(faces['fixture-19-italic'].poster, false);
  assert.throws(() => specimenFamilies(SITE_PAIRING, [...families, families[0]]), /duplicate/i);
  assert.throws(() => specimenFamilies(SITE_PAIRING, [{ ...families[0], styles: [{ ...families[0].styles[0], id: 'hanken' }] }]), /duplicate/i);
});
