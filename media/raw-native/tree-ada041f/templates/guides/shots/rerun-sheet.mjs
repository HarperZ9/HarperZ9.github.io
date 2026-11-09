// rerun turnaround and poses, in its home style (pixel).
import { shot } from "../stage.mjs";
// ?layer=art|hud-black|hud-white on the module URL picks a layer (see stage.mjs).
const layer = new URL(import.meta.url).searchParams.get("layer");
export default shot({ guide: "rerun", style: "pixel", kind: "sheet", layer });
