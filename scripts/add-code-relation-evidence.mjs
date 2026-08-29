import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const registryPath = resolve(root, "system", "systems.json");
const registry = JSON.parse(await readFile(registryPath, "utf8"));
const systems = new Map(registry.systems.map((system) => [system.id, system]));

const records = [
  ["flywheel", "flywheel-gather-lane-code", "Flywheel Gather lane declaration", "https://github.com/HarperZ9/flywheel/blob/3b0a1d5e90326edb59ad010ffdb1e1934b96f19a/harness/lanes.py#L55-L58", "The pinned lane registry declares Gather's package, command, MCP arguments, version, source repository, and role."],
  ["flywheel", "flywheel-crucible-lane-code", "Flywheel Crucible lane declaration", "https://github.com/HarperZ9/flywheel/blob/3b0a1d5e90326edb59ad010ffdb1e1934b96f19a/harness/lanes.py#L59-L62", "The pinned lane registry declares Crucible's package, command, MCP arguments, version, source repository, and role."],
  ["flywheel", "flywheel-index-lane-code", "Flywheel Index lane declaration", "https://github.com/HarperZ9/flywheel/blob/3b0a1d5e90326edb59ad010ffdb1e1934b96f19a/harness/lanes.py#L63-L66", "The pinned lane registry declares Index's package, command, MCP arguments, source repository, and role; its version field is visibly stale against the published package."],
  ["flywheel", "flywheel-forum-lane-code", "Flywheel Forum lane declaration", "https://github.com/HarperZ9/flywheel/blob/3b0a1d5e90326edb59ad010ffdb1e1934b96f19a/harness/lanes.py#L67-L70", "The pinned lane registry declares Forum's package, command, MCP arguments, version, source repository, and role."],
  ["flywheel", "flywheel-learn-lane-code", "Flywheel Learn lane declaration", "https://github.com/HarperZ9/flywheel/blob/3b0a1d5e90326edb59ad010ffdb1e1934b96f19a/harness/lanes.py#L71-L74", "The pinned lane registry declares Learn's npm package, Node MCP entry, version, source repository, and role."],
  ["flywheel", "flywheel-telos-lane-code", "Flywheel Telos lane declaration", "https://github.com/HarperZ9/flywheel/blob/3b0a1d5e90326edb59ad010ffdb1e1934b96f19a/harness/lanes.py#L75-L78", "The pinned lane registry declares Telos's npm package, MCP entry, version, source repository, and role."],
  ["flywheel", "flywheel-relay-lane-code", "Flywheel Relay lane declaration", "https://github.com/HarperZ9/flywheel/blob/3b0a1d5e90326edb59ad010ffdb1e1934b96f19a/harness/lanes.py#L83-L86", "The pinned lane registry declares Relay's package, command, MCP arguments, source repository, and role."],
  ["flywheel", "flywheel-plexus-lane-code", "Flywheel Plexus lane declaration", "https://github.com/HarperZ9/flywheel/blob/3b0a1d5e90326edb59ad010ffdb1e1934b96f19a/harness/lanes.py#L87-L90", "The pinned lane registry declares Plexus's package, command, MCP arguments, source repository, and role."],
  ["flywheel", "flywheel-mneme-lane-code", "Flywheel Mneme lane declaration", "https://github.com/HarperZ9/flywheel/blob/3b0a1d5e90326edb59ad010ffdb1e1934b96f19a/harness/lanes.py#L91-L94", "The pinned lane registry declares Mneme's package, command, MCP arguments, source repository, and role; its version field is visibly stale against source."],
  ["flywheel", "flywheel-accountable-surface-lane-code", "Flywheel Accountable Surface lane declaration", "https://github.com/HarperZ9/flywheel/blob/3b0a1d5e90326edb59ad010ffdb1e1934b96f19a/harness/lanes.py#L100-L107", "The pinned lane registry declares Accountable Surface's server entry, source repository, extra source roots, and actuation role."],
  ["truth-enb", "truth-enb-runtime-core-link-code", "Truth ENB runtime-core build linkage", "https://github.com/HarperZ9/truth-enb/blob/c2eaa9f51f78af0131cc475bc4438beb431cfbec/runtime/CMakeLists.txt#L115-L136", "The pinned CMake source compiles and links ENB Runtime Core into the Truth runtime target."],
  ["truth-enb", "truth-enb-skyrimbridge-code", "Truth ENB optional SkyrimBridge bindings", "https://github.com/HarperZ9/truth-enb/blob/c2eaa9f51f78af0131cc475bc4438beb431cfbec/shaders/truth/TruthPrepassCore.fxh#L21-L24", "The pinned shader source defines SkyrimBridge interoperability as an optional surface and preserves a safe path when its values are absent."],
  ["elder-enb", "elder-enb-runtime-core-link-code", "Elder ENB runtime-core build linkage", "https://github.com/HarperZ9/elder-enb/blob/494f26b4e66fd9e79722d6b9e3a14cfb4afda9e0/native/runtime/CMakeLists.txt#L116-L134", "The pinned public-main CMake source builds and links ENB Runtime Core into Elder's optional native runtime."],
  ["elder-enb", "elder-enb-skyrimbridge-code", "Elder ENB optional SkyrimBridge bindings", "https://github.com/HarperZ9/elder-enb/blob/494f26b4e66fd9e79722d6b9e3a14cfb4afda9e0/native/runtime/include/elder/runtime/RenderPayloadController.hpp#L15-L50", "The pinned public-main header declares SkyrimBridge-named parameters and explicitly describes the source as optional."],
  ["engine-revival", "engine-revival-brender-evidence-code", "Engine Revival BRender evidence import boundary", "https://github.com/HarperZ9/engine-revival/blob/0af6d527860a63c418b5775dc0efe9ba89557604/scripts/regenerate_brender_publication_boundary.py#L111-L123", "The pinned generator identifies BRender Archival as an external evidence owner and records the exact checkout recipe rather than treating it as a runtime dependency."],
  ["studio-engine", "studio-engine-raw-bridge-code", "Studio Engine optional RAW CLI bridge", "https://github.com/HarperZ9/studio-engine/blob/4dc706555258eeb8a80841ae4f0b2482dabe6f89/studio_engine/native_render.py#L1-L28", "The pinned Python module defines RAW's native CLI as a separately built optional renderer and records honest absence when it is unavailable."],
  ["chorus", "chorus-gather-corpus-code", "Chorus Gather-corpus loader", "https://github.com/HarperZ9/chorus/blob/d88da755850fb6827c6faf25d73ae3bbc226062e/src/chorus/cli.py#L21-L38", "The pinned CLI source loads Gather corpus directories through catalog.jsonl and the content-addressed object layout."],
];

for (const [systemId, id, label, href, summary] of records) {
  const system = systems.get(systemId);
  if (!system) throw new Error(`missing source system ${systemId}`);
  const record = { id, type: "code-permalink", label, href, date: "2026-08-28", status: "verified", summary };
  const index = system.evidence.findIndex((evidence) => evidence.id === id);
  if (index >= 0) system.evidence[index] = record;
  else system.evidence.push(record);
}

const relationEvidence = new Map([
  ["flywheel|integrates-lane|gather", "flywheel-gather-lane-code"],
  ["flywheel|integrates-lane|crucible", "flywheel-crucible-lane-code"],
  ["flywheel|integrates-lane|index", "flywheel-index-lane-code"],
  ["flywheel|integrates-lane|forum", "flywheel-forum-lane-code"],
  ["flywheel|integrates-lane|learn", "flywheel-learn-lane-code"],
  ["flywheel|integrates-lane|telos", "flywheel-telos-lane-code"],
  ["flywheel|integrates-lane|relay", "flywheel-relay-lane-code"],
  ["flywheel|integrates-lane|plexus", "flywheel-plexus-lane-code"],
  ["flywheel|integrates-lane|mneme", "flywheel-mneme-lane-code"],
  ["flywheel|integrates-lane|accountable-surface", "flywheel-accountable-surface-lane-code"],
  ["truth-enb|build-dependency|enb-runtime-core", "truth-enb-runtime-core-link-code"],
  ["truth-enb|optional-runtime-integration|skyrimbridge", "truth-enb-skyrimbridge-code"],
  ["elder-enb|optional-native-runtime-dependency|enb-runtime-core", "elder-enb-runtime-core-link-code"],
  ["elder-enb|optional-runtime-integration|skyrimbridge", "elder-enb-skyrimbridge-code"],
  ["engine-revival|accepts-evidence-from|brender-archival", "engine-revival-brender-evidence-code"],
  ["studio-engine|optional-native-render-bridge|raw", "studio-engine-raw-bridge-code"],
  ["chorus|accepts-corpus-from|gather", "chorus-gather-corpus-code"],
]);

for (const relation of registry.relations) {
  const key = `${relation.source}|${relation.relation}|${relation.target}`;
  const evidenceId = relationEvidence.get(key);
  if (!evidenceId) throw new Error(`missing code evidence mapping for ${key}`);
  relation.evidenceIds = [evidenceId, ...relation.evidenceIds.filter((id) => id !== evidenceId)];
}

await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
console.log(`added ${records.length} immutable code evidence records for ${registry.relations.length} relations`);
