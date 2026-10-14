// pylon in the pixel template world.
import { shot } from "../stage.mjs";
// ?layer=art|hud-black|hud-white on the module URL picks a layer (see stage.mjs).
const layer = new URL(import.meta.url).searchParams.get("layer");
export default shot({ guide: "pylon", style: "pixel", layer });
