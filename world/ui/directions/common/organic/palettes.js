// The studio model's palettes, fetched only when a page names a material the hand's built-in copy lacks.
import { workspaceRoot } from "./root.js";

export async function studioPalettes() {
  try {
    const m = await import(workspaceRoot() + "studio/lib/materials.mjs");
    return Object.fromEntries(m.MATERIALS.map((x) => [x.id, x.palette]));
  } catch (e) { console.info("organic: studio materials not reachable, using built-in palettes", e.message); return {}; }
}
