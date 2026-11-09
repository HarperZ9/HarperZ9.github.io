// rerun in the thriller world, close framing.
import { shot } from "../stage.mjs";
const layer = new URL(import.meta.url).searchParams.get("layer");
export default shot({ guide: "rerun", style: "thriller", frame: "close", layer });
