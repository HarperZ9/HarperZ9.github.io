// tallow in the painted world, close framing.
import { shot } from "../stage.mjs";
const layer = new URL(import.meta.url).searchParams.get("layer");
export default shot({ guide: "tallow", style: "painted", frame: "close", layer });
