import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const path = resolve(root, "system", "systems.json");
const registry = JSON.parse(await readFile(path, "utf8"));

const dedicatedSecurityPages = new Set(["array", "seed", "sofer", "isomorph", "bounds"]);
for (const system of registry.systems) {
  if (!dedicatedSecurityPages.has(system.id)) continue;
  system.href = `${system.id}.html`;
  const publicReceipt = system.evidence?.find((record) => record.type === "public-receipt") ?? system.evidence?.[0];
  if (publicReceipt) publicReceipt.href = `https://harperz9.github.io/${system.id}.html`;
}

const additions = [
  {
    id: "kun",
    name: "Kun",
    purpose: "Maintain local access-recovery memory for owned systems through path-only receipts, redacted diagnostics, rotation notes, and operator runbooks without storing raw credentials.",
    useCases: ["local access-recovery hygiene", "credential-rotation memory", "redacted operational diagnostics"],
    href: "kun.html",
    sourceHref: null,
    domains: ["security-privacy", "developer-infrastructure"],
    family: "security",
    architectureRole: "local-access-recovery-vault",
    audiences: ["operators of owned systems", "security reviewers"],
    deploymentContexts: ["local-only workstations", "owned operational environments"],
    maturity: "controlled-private",
    placement: "supporting",
    accessMode: "request",
    entryCommand: null,
    verificationCommand: null,
    evidence: [{
      id: "kun-public-boundary-page",
      type: "public-receipt",
      label: "Kun public boundary page",
      href: "https://harperz9.github.io/kun.html",
      date: "2026-08-28",
      status: "verified",
      summary: "The public page describes Kun's path-only and redacted-receipt role and states that raw credentials, recovery instructions, and protected content are not published.",
    }],
    limitations: ["No raw credential, credential value, credential recovery instruction, bypass step, private browser state, or protected content is published.", "Path-only receipt design does not replace a dedicated secrets manager."],
    boundary: "Kun records where recovery authority lives and how to audit the process. It does not publish or retain raw keys, tokens, passwords, seed phrases, private browser state, or protected content.",
    inputs: ["owned-system recovery paths", "rotation metadata", "redacted diagnostics and local runbook state"],
    outputs: ["path-only receipts", "rotation reminders", "diagnostic summaries and recovery checklist state"],
    dependencies: [],
    related: ["bounds", "secret-redact-io"],
    lastVerified: "2026-08-28",
    primaryDomain: "security-privacy",
    productType: "local access-recovery vault",
    releaseState: "controlled private system; public capability page",
  },
];

registry.systems = registry.systems.filter((system) => system.id !== "aeterna");

for (const addition of additions) {
  const index = registry.systems.findIndex((system) => system.id === addition.id);
  if (index >= 0) registry.systems[index] = addition;
  else registry.systems.push(addition);
}

await writeFile(path, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
console.log(`merged ${additions.length} upstream private-system record and excluded the non-public Aeterna prototype`);
