// findings-schema.mjs: a JSON Schema check for the research records, enough of draft 2020-12 for
// findings/data/research-record.schema.json and glossary.schema.json: type, const, enum, pattern, required,
// properties, additionalProperties false, items and local $ref. A keyword outside that set throws, so the check
// never passes a record by skipping a rule it does not know. tests/test_findings_pages.py checks the same records
// with a second, independent reader.
const KNOWN = new Set(["$schema", "$id", "$defs", "$ref", "title", "description", "type", "const", "enum", "pattern",
  "required", "properties", "additionalProperties", "items"]);

function typeOk(type, v) {
  if (type === "object") return v !== null && typeof v === "object" && !Array.isArray(v);
  if (type === "array") return Array.isArray(v);
  if (type === "integer") return Number.isInteger(v);
  if (type === "number") return typeof v === "number";
  if (type === "null") return v === null;
  return typeof v === type;
}

function check(schema, v, root, where, errs) {
  for (const k of Object.keys(schema)) if (!KNOWN.has(k)) throw new Error(`schema: unsupported keyword ${k} at ${where}`);
  if (schema.$ref) {
    const name = schema.$ref.replace(/^#\/\$defs\//, "");
    if (!root.$defs?.[name]) throw new Error(`schema: no $defs/${name}`);
    return check(root.$defs[name], v, root, where, errs);
  }
  if (schema.type && !typeOk(schema.type, v)) return errs.push(`${where}: not ${schema.type}`);
  if ("const" in schema && v !== schema.const) errs.push(`${where}: must be ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(v)) errs.push(`${where}: ${JSON.stringify(v)} not one of ${schema.enum.join(", ")}`);
  if (schema.pattern && !(typeof v === "string" && new RegExp(schema.pattern, "u").test(v))) errs.push(`${where}: does not match ${schema.pattern}`);
  if (typeOk("object", v)) {
    for (const r of schema.required || []) if (!(r in v)) errs.push(`${where}: missing ${r}`);
    for (const [k, val] of Object.entries(v)) {
      if (schema.properties?.[k]) check(schema.properties[k], val, root, `${where}.${k}`, errs);
      else if (schema.additionalProperties === false) errs.push(`${where}: unexpected ${k}`);
    }
  }
  if (Array.isArray(v) && schema.items) v.forEach((x, i) => check(schema.items, x, root, `${where}[${i}]`, errs));
  return errs;
}

// validate(schema, value) -> [] when the value fits, else one line per problem
export const validate = (schema, value) => check(schema, value, schema, "$", []);
