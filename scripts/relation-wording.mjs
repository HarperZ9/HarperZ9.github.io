// Reader wording for each typed relation in system/systems.json.
//
// The registry key (for example "integrates-lane") stays in the data and in
// data attributes, because scripts and tests match on it. Readers see these
// words instead. A record page reads "<source> <before> <target> <after>", so
// "Flywheel includes Relay as a lane". A capability-map row puts the source
// and target in their own columns and shows relationLabel(), the two parts
// joined: "includes as a lane".
//
// The wording claims no more than every relation of that key supports. Some
// Flywheel lanes are only declared in its lane registry, so the lane wording
// says "includes", not "launches" or "runs"; each relation's claimScope says
// what was checked for that lane.
export const RELATION_WORDING = Object.freeze({
  "accepts-corpus-from": { before: "accepts corpus from", after: "" },
  "accepts-evidence-from": { before: "accepts evidence from", after: "" },
  "build-dependency": { before: "builds against", after: "" },
  "integrates-lane": { before: "includes", after: "as a lane" },
  "optional-native-render-bridge": { before: "can invoke", after: "as an optional native bridge" },
  "optional-native-runtime-dependency": { before: "optionally links", after: "at runtime" },
  "optional-runtime-integration": { before: "supports an optional runtime integration with", after: "" },
});

export function relationWording(key) {
  const wording = RELATION_WORDING[key];
  if (!wording) throw new Error(`no reader wording for typed relation ${key}`);
  return wording;
}

export function relationLabel(key) {
  const { before, after } = relationWording(key);
  return after ? `${before} ${after}` : before;
}
