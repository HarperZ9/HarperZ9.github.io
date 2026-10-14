// tallow in the thriller world, medium framing.
import { shot } from "../stage.mjs";
const layer = new URL(import.meta.url).searchParams.get("layer");
export default shot({ guide: "tallow", style: "thriller", frame: "medium", layer });
