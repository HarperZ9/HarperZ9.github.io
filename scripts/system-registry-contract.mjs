const REQUIRED_SYSTEM_STRINGS = [
  "id",
  "name",
  "purpose",
  "href",
  "primaryDomain",
  "productType",
  "architectureRole",
  "maturity",
  "releaseState",
  "placement",
  "accessMode",
  "lastVerified",
  "boundary",
];

const REQUIRED_SYSTEM_ARRAYS = [
  "domains",
  "useCases",
  "evidence",
  "limitations",
  "inputs",
  "outputs",
  "dependencies",
  "related",
];

const GENERIC_ROLES = new Set([
  "engine",
  "tool",
  "platform-component",
  "constellation-member",
  "controlled-private-constellation",
]);

function invariant(condition, message) {
  if (!condition) throw new Error(`system registry contract: ${message}`);
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function unique(values, label) {
  const seen = new Set();
  for (const value of values) {
    invariant(!seen.has(value), `duplicate ${label}: ${value}`);
    seen.add(value);
  }
  return seen;
}

export function validateRegistry(registry) {
  invariant(registry && typeof registry === "object", "root must be an object");
  invariant(registry.schema === "harperz9-systems/v4", "schema must be harperz9-systems/v4");
  invariant(Array.isArray(registry.domains), "domains must be an array");
  invariant(Array.isArray(registry.systems), "systems must be an array");
  invariant(Array.isArray(registry.relations), "relations must be an array");
  invariant(registry.relationshipPolicy?.relatedUsage === "navigation-only", "related must be navigation-only");
  invariant(registry.relationshipPolicy?.integrationClaims === "relations-only", "integration claims must use typed relations");

  const domainIds = unique(registry.domains.map((domain) => domain.id), "domain id");
  for (const domain of registry.domains) {
    invariant(nonEmptyString(domain.id), "domain id is required");
    invariant(nonEmptyString(domain.label), `${domain.id}: domain label is required`);
    invariant(nonEmptyString(domain.summary), `${domain.id}: domain summary is required`);
  }

  const systemIds = unique(registry.systems.map((system) => system.id), "system id");
  const evidenceIds = new Set();
  for (const system of registry.systems) {
    for (const key of REQUIRED_SYSTEM_STRINGS) {
      invariant(nonEmptyString(system[key]), `${system.id || "unknown system"}: ${key} is required`);
    }
    for (const key of REQUIRED_SYSTEM_ARRAYS) {
      invariant(Array.isArray(system[key]), `${system.id}: ${key} must be an array`);
    }
    invariant(system.domains.length > 0, `${system.id}: at least one domain is required`);
    invariant(system.domains.includes(system.primaryDomain), `${system.id}: primaryDomain must be in domains`);
    for (const domainId of system.domains) {
      invariant(domainIds.has(domainId), `${system.id}: unknown domain ${domainId}`);
    }
    invariant(!GENERIC_ROLES.has(system.architectureRole), `${system.id}: architectureRole is too generic`);
    invariant(system.inputs.length > 0, `${system.id}: concrete inputs are required`);
    invariant(system.outputs.length > 0, `${system.id}: concrete outputs are required`);
    invariant(system.evidence.length > 0, `${system.id}: evidence is required`);
    for (const target of system.related) {
      invariant(systemIds.has(target), `${system.id}: unknown related system ${target}`);
    }
    for (const evidence of system.evidence) {
      invariant(nonEmptyString(evidence.id), `${system.id}: evidence id is required`);
      invariant(!evidenceIds.has(evidence.id), `duplicate evidence id: ${evidence.id}`);
      evidenceIds.add(evidence.id);
      for (const key of ["type", "label", "href", "date", "status", "summary"]) {
        invariant(nonEmptyString(evidence[key]), `${system.id}/${evidence.id}: ${key} is required`);
      }
    }
  }

  const relationKeys = [];
  for (const relation of registry.relations) {
    for (const key of ["source", "target", "relation", "status", "claimScope"]) {
      invariant(nonEmptyString(relation[key]), `relation ${key} is required`);
    }
    invariant(systemIds.has(relation.source), `relation source does not resolve: ${relation.source}`);
    invariant(systemIds.has(relation.target), `relation target does not resolve: ${relation.target}`);
    invariant(relation.source !== relation.target, `self relation is not allowed: ${relation.source}`);
    invariant(relation.status === "verified-in-source", `${relation.source} -> ${relation.target}: unsupported relation status`);
    invariant(Array.isArray(relation.evidenceIds) && relation.evidenceIds.length > 0, `${relation.source} -> ${relation.target}: evidenceIds required`);
    for (const evidenceId of relation.evidenceIds) {
      invariant(evidenceIds.has(evidenceId), `${relation.source} -> ${relation.target}: unknown evidence ${evidenceId}`);
    }
    invariant(!["hierarchy", "owns", "parent-of"].includes(relation.relation), `${relation.source} -> ${relation.target}: generic hierarchy is prohibited`);
    relationKeys.push(`${relation.source}|${relation.relation}|${relation.target}`);
  }
  unique(relationKeys, "relation");

  return registry;
}
