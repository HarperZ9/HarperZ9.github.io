// tallow in the thriller world, close framing.
import { shot } from "../stage.mjs";
const layer = new URL(import.meta.url).searchParams.get("layer");
export default shot({ guide: "tallow", style: "thriller", frame: "close", layer });
