// pylon in the painted world, close framing.
import { shot } from "../stage.mjs";
const layer = new URL(import.meta.url).searchParams.get("layer");
export default shot({ guide: "pylon", style: "painted", frame: "close", layer });
