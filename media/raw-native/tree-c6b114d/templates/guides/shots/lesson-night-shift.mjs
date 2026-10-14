// The playable lesson for film 1, Night Shift, as a still: Tallow in the thriller corridor.
import { shot } from "../stage.mjs";
// ?layer=art|hud-black|hud-white on the module URL picks a layer (see stage.mjs).
const layer = new URL(import.meta.url).searchParams.get("layer");
import { LESSON } from "../beats.mjs";
export default shot({ guide: "tallow", style: "thriller", beat: LESSON, title: "Night Shift (lesson still)", layer });
