// walk-frame.mjs: the site's frame round the Low Water walk (walk.html). The walk is the engine's own code and
// stays unchanged; this file only lets a person leave it, says where they stand in words, and tells the page that
// opened it whether the walk started.
//   Back to the page, or Esc when the mouse is free: leave (the page that opened the walk closes it and frees the GPU).
//   Every 2 s at most, a polite line says the region, the weather, the part of the day and how you move, and only
//   when one of those has changed, so it never talks over a reader.
const inFrame = window.parent !== window;
const tell = (msg) => { if (inFrame) window.parent.postMessage({ lowWater: msg.kind, ...msg }, location.origin); };
const leave = () => { if (inFrame) tell({ kind: "leave" }); else location.href = "/low-water.html#island"; };

document.getElementById("leave").addEventListener("click", leave);
addEventListener("keydown", (e) => {
  // the first Esc frees the mouse (the browser does that itself); with the mouse free, Esc leaves
  if (e.key === "Escape" && !document.pointerLockElement) { e.preventDefault(); leave(); }
});

const said = document.getElementById("said"), REGIONS = ["the open sea", "Thaw Country", "the Folded Uplands", "the Fog Forest", "the Storm Coast", "the Canyon and Badlands", "the Marsh", "the City Across the Water", "the Works", "the Monument Ground", "the Drowned Quarter", "the Far-North Works Town"];
let last = "", started = false;
function words(s, W) {
  const km = (m) => (m / 1000).toFixed(1);
  const how = W.cam.fly ? `flying ${Math.round(s.at[1])} m up` : "on foot";
  return `You are in ${REGIONS[s.region] || "the island"}, ${s.air}, ${s.part}, ${how}, ${km(s.at[0])} km east and ${km(s.at[2])} km south of the island's north-west corner.`;
}
const timer = setInterval(() => {
  const W = globalThis.__lwWorld;
  if (globalThis.__lwWorldError) { tell({ kind: "error", error: String(globalThis.__lwWorldError).split("\n")[0] }); clearInterval(timer); return; }
  if (!W) return;
  const s = W.stats();
  if (s.region == null) return;
  if (!started) { started = true; tell({ kind: "started", adapter: s.adapter }); document.getElementById("view").focus(); }
  const key = `${s.region}|${s.air}|${s.part}|${W.cam.fly}`;
  if (key !== last) { last = key; said.textContent = words(s, W); }
}, 2000);
