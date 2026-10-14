// rerun in the pixel world, medium framing.
import { shot } from "../stage.mjs";
const layer = new URL(import.meta.url).searchParams.get("layer");
export default shot({ guide: "rerun", style: "pixel", frame: "medium", layer });
