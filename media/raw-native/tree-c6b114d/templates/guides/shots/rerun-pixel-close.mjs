// rerun in the pixel world, close framing.
import { shot } from "../stage.mjs";
const layer = new URL(import.meta.url).searchParams.get("layer");
export default shot({ guide: "rerun", style: "pixel", frame: "close", layer });
