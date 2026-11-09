// pylon in the thriller world, medium framing.
import { shot } from "../stage.mjs";
const layer = new URL(import.meta.url).searchParams.get("layer");
export default shot({ guide: "pylon", style: "thriller", frame: "medium", layer });
