import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { validateRegistry } from "./system-registry-contract.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const systems = validateRegistry(JSON.parse(await readFile(resolve(root, "system", "systems.json"), "utf8")));
const records = systems.systems
  .filter((system) => system.domains.includes("security-privacy"))
  .map((system) => ({
    slug: system.id,
    name: system.name,
    purpose: system.purpose,
    maturity: system.maturity,
    source: system.sourceHref,
    installOrEntry: system.entryCommand,
    verificationCommand: system.verificationCommand,
    limitations: system.limitations,
    authorizationBoundary: system.boundary,
    evidenceDate: system.lastVerified,
  }));

const output = {
  schema: "harperz9-security-tools/v2",
  derivedFrom: systems.schema,
  records,
};
await writeFile(resolve(root, "security-tools.json"), `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`rendered ${records.length} distinct security records`);
