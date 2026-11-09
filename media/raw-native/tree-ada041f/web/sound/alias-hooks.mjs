// SPDX-License-Identifier: FSL-1.1-MIT
// Node module hooks: resolve "@raw-native/..." the way a media bundle's import
// map does in the browser, so scene-sheet.mjs can load a bundled scene in Node.
let base = null;
export function initialize(data) { base = data.base; }
export function resolve(specifier, context, next) {
  if (base && specifier.startsWith("@raw-native/")) return next(new URL(specifier.slice("@raw-native/".length), base).href, context);
  return next(specifier, context);
}
