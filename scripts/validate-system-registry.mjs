import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { validateRegistry } from "./system-registry-contract.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const registryPath = resolve(root, "system", "systems.json");
const registry = validateRegistry(JSON.parse(await readFile(registryPath, "utf8")));

console.log(`validated ${registry.systems.length} systems and ${registry.relations.length} typed relations`);
