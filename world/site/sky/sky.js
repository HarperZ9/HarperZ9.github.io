// sky.js: the home's water lit by the visitor's own sky. Off until the visitor asks: the Sky control opens a small
// dialog, and nothing is requested before a choice there.
//   Place: the browser's location, only after "Use my location", rounded to 0.1 degree and kept in this tab's memory;
//     or a guess from the time zone, which needs no permission and is labelled as a guess.
//   Facing: on a phone, the compass (after "Face the sky"; iOS asks its own permission from that tap); otherwise a
//     fixed view toward the Sun, or the Moon at night.
//   Weather: estimated from season, hour and latitude, labelled; real wind from Open-Meteo only after its own opt-in,
//     which sends the rounded position to open-meteo.com.
// Sun and Moon come from astro.mjs (NOAA solar position; Meeus for the Moon). The field (field/field.js) draws them:
// sky colour by its physically based scattering, the glint on the sea, the Moon's phase, stars turned by sidereal time.
import { sunPosition, moonPosition, localSidereal, coarse, placeFromTimeZone } from "./astro.mjs";
import { estimatedWeather, fromOpenMeteo, OPEN_METEO_FIELDS, PLANTED, seaState, beaufort } from "./weather.mjs";

const root = document.documentElement;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const POINTS = ["north", "north-northeast", "northeast", "east-northeast", "east", "east-southeast", "southeast", "south-southeast",
  "south", "south-southwest", "southwest", "west-southwest", "west", "west-northwest", "northwest", "north-northwest"];
const bearing = (az) => POINTS[Math.round((((az % 360) + 360) % 360) / 22.5) % 16];

// the field's parameters for a place, an instant and a facing direction (degrees from north; null faces the light)
// quality ladder: cloud march steps by device; a phone gets fewer, a still frame (reduced motion) can afford more
export const cloudSteps = () => (matchMedia("(prefers-reduced-motion: reduce)").matches ? 32 : matchMedia("(pointer: coarse)").matches ? 10 : 24);

export function skySpace(date, { lat, lon }, { heading = null, tall = false, wx = null } = {}) {
  wx = wx || estimatedWeather(date, lat, lon);
  const sun = sunPosition(date, lat, lon), moon = moonPosition(date, lat, lon);
  const day = sun.alt > -5;
  let el, az, lightScale = 1, expo;
  if (day) {
    el = Math.max(sun.alt, -4.5); az = sun.az;
    // exposure as a photographer would set it: brighter sun, shorter exposure; twilight opens up
    expo = el >= 2 ? 7 + 2 * clamp((30 - el) / 28, 0, 1) : 9 + (2 - el) * 6;
  } else if (moon.alt > 1) {
    el = moon.alt; az = moon.az; lightScale = Math.max(0.08, moon.illuminated); expo = 34;
  } else {
    // the Moon is down: starlight, from low in the Moon's direction so the sea still has a faint sheen
    el = 2; az = moon.az; lightScale = 0.06; expo = 34;
  }
  // the light sits off centre, inside the frame: the night framing is narrower, so its offset is smaller
  const yaw = heading ?? az - (day ? (tall ? 12 : 25) : (tall ? 5 : 12));
  // the sea is the subject: by day the view tilts up only a little toward a high Sun; at night it tilts so a low Moon
  // stands in the narrower night framing (half height about 13 degrees)
  const lift = day ? clamp((el - 15) * 0.1, 0, 4) : clamp(el * 0.6 - 3.2, 0, 11);
  const cam = day ? { h: 1.4, pitch: 2.2 + lift, yaw, focal: 1.35 } : { h: 2.5, pitch: 3.2 + lift, yaw, focal: 2.2 };
  // the weather the scene draws: storms darken the cloud base; a rainbow needs rain, the Sun up and lower than
  // 42 degrees, and gaps in the cloud for sunlight; a 22 degree halo needs thin high cloud, which is likely (not
  // measured: cloud type is not in the data) at middling cover without rain
  const storm = wx.thunder ? 1 : Math.max(0, (wx.cloud - 0.85) / 0.15) * 0.5;
  const rainbow = day && sun.alt > 0 && sun.alt < 42 && wx.rain > 0 && wx.cloud < 0.9 ? Math.min(1, 0.4 + wx.rain / 3) * (1 - wx.cloud * 0.6) : 0;
  const halo = day && sun.alt > 8 && wx.rain === 0 && wx.cloud > 0.25 && wx.cloud < 0.6 ? 0.6 : 0;
  // daylight under cloud: the direct beam is cut by the cover (storms most), so expose for what is left
  // exposure makes up only part of the loss, so an overcast reads grey and a storm reads dark, as the eye sees them
  const dim = Math.max(0.12, 1 - 0.5 * wx.cloud - 0.35 * storm);
  if (day) { lightScale *= dim; expo /= Math.max(0.5, Math.sqrt(dim)); }
  // facing away from the Sun into rain with a bow in the sky, the view lifts so the arc's crown is in frame
  const awayFromSun = heading != null && Math.abs(((heading - sun.az + 540) % 360) - 180) > 120;
  if (rainbow > 0 && awayFromSun) cam.pitch = Math.max(cam.pitch, 42 - Math.max(0, sun.alt) - 15);
  // waves run downwind: toward windFrom + 180, as an angle from east toward north for the cascades
  const to = ((wx.windFrom + 180) * Math.PI) / 180, windAngle = Math.atan2(Math.cos(to), Math.sin(to));
  return {
    space: { light: { el, az }, cam, wind: wx.wind, windAngle, expo, night: day ? 0 : 1, phase: moon.phaseAngle, lightScale,
      wx: { cloud: wx.cloud, storm, rain: wx.rain, rainbow, halo }, cloudSteps: cloudSteps(), sid: { lat, lst: localSidereal(date, lon) } },
    sun, moon, day, wx, sea: seaState(wx.wind),
  };
}

function weatherWords(r) {
  const w = r.wx, src = w.source === "open-meteo" ? "from Open-Meteo" : w.source === "planted" ? "set in the address" : "estimated from season, hour and place, not measured";
  const sky = w.thunder ? "thunderstorm" : w.rain > 0 ? `rain ${w.rain} mm an hour` : w.cloud > 0.7 ? "overcast" : w.cloud > 0.3 ? "broken cloud" : "mostly clear";
  return `Weather ${src}: wind ${w.wind.toFixed(0)} m/s (force ${beaufort(w.wind)}) from the ${bearing(w.windFrom)}, ${sky}; waves about ${r.sea.Hs.toFixed(1)} m, every ${r.sea.Tp.toFixed(0)} s.`;
}
function words(r, place, windNote) {
  const s = r.sun, m = r.moon;
  const sun = s.alt > 0 ? `Sun ${Math.round(s.alt)} degrees up, toward the ${bearing(s.az)}` : `Sun ${Math.round(-s.alt)} degrees below the horizon, toward the ${bearing(s.az)}`;
  const lit = Math.round(m.illuminated * 100);
  const moon = `Moon ${lit} percent lit and ${m.waxing ? "waxing" : "waning"}, ${m.alt > 0 ? `${Math.round(m.alt)} degrees up, toward the ${bearing(m.az)}` : "below the horizon"}`;
  const where = place.guessed ? `Place estimated from your time zone (${place.zone}), about ${place.lat}, ${place.lon}` : place.planted ? `Place set in the address: ${place.lat}, ${place.lon}` : `Your location, rounded to ${place.lat}, ${place.lon}`;
  return `${sun}. ${moon}. ${where}. ${windNote}`;
}

const html = `<form method="dialog" class="sky-panel">
  <h2>Your sky</h2>
  <p>Light the water with the Sun and the Moon as they stand where you are, at this moment.</p>
  <div class="sky-row"><button type="button" data-sky="locate">Use my location</button>
    <p>Your browser asks first. The position is rounded to about 11 km, used only in this tab, and never sent or stored.</p></div>
  <div class="sky-row"><button type="button" data-sky="zone">Use my time zone</button>
    <p>No permission. The place is a guess from your clock.</p></div>
  <div class="sky-row" data-sky-face hidden><button type="button" data-sky="face" aria-pressed="false">Face the sky</button>
    <p>Turn the phone to look around. Uses the compass, in this tab only.</p></div>
  <label class="sky-row sky-check"><input type="checkbox" data-sky="weather"> <span>Real weather from Open-Meteo. Off unless you tick it: it sends the rounded position to open-meteo.com. Without it the weather is estimated from season, hour and place, and says so.</span></label>
  <div class="sky-row"><button type="button" data-sky="sound" aria-pressed="false">Sound</button>
    <p>Sea, wind, rain and thunder, made from physics in your browser. Off until you press it; press again to mute.</p></div>
  <p class="sky-status" role="status" aria-live="polite"></p>
  <div class="sky-row sky-end"><button type="button" data-sky="off" hidden>Turn off</button><button value="close">Close</button></div>
</form>`;

export function mountSky({ button, getField, tall = () => innerHeight > innerWidth, onActive = () => {} }) {
  const dlg = document.createElement("dialog");
  dlg.className = "sky-dialog"; dlg.setAttribute("aria-label", "Your sky"); dlg.innerHTML = html;
  document.body.append(dlg);
  const $ = (k) => dlg.querySelector(`[data-sky="${k}"]`), status = dlg.querySelector(".sky-status");
  let place = null, heading = null, realWx = null, timer = 0, lastHeadingDraw = 0, field = null, themeBefore, planted = null, last = null, sound = null, boltTimer = 0;
  const canFace = typeof DeviceOrientationEvent !== "undefined" && matchMedia("(pointer: coarse)").matches;
  if (canFace) dlg.querySelector("[data-sky-face]").hidden = false;

  async function draw(ms = 2600, when = null) {
    if (!place) return;
    const now = when || place.at || new Date();
    const wx = planted ? { ...PLANTED[planted], source: "planted" } : realWx;
    const r = skySpace(now, place, { heading, tall: tall(), wx });
    last = r;
    root.dataset.theme = r.day ? "light" : "dark"; // the page's light follows the sky while Sky is on; not saved
    field = field || (await getField());
    if (field) field.sky(r.space, ms);
    const windNote = weatherWords(r);
    if (sound) sound.set({ wind: r.wx.wind, rain: r.wx.rain, Tp: r.sea.Tp, breaking: Math.min(1, Math.max(0, (r.wx.wind - 7) / 13)) });
    clearTimeout(boltTimer); if (r.wx.thunder) storm();
    status.textContent = words(r, place, windNote) + (field ? "" : " The live water is not available on this device, so the picture stays as it was.");
    button.setAttribute("aria-pressed", "true"); $("off").hidden = false;
  }
  function begin(p) {
    if (!place) themeBefore = root.dataset.theme;
    place = p; onActive(true); draw();
    clearInterval(timer); if (!p.at) timer = setInterval(() => draw(8000), 60000);
    if ($("weather").checked) fetchWeather();
  }
  // lightning every 6 to 20 seconds while a thunderstorm lasts; its thunder follows at the speed of sound
  function storm() {
    boltTimer = setTimeout(() => {
      if (!place || !last?.wx.thunder) return;
      const distance = 800 + Math.random() * 9000;
      if (field?.lightning) field.lightning(Math.min(1, 2500 / distance));
      sound?.thunder(distance);
      storm();
    }, 6000 + Math.random() * 14000);
  }
  async function fetchWeather() {
    if (!place) return;
    try {
      const u = `https://api.open-meteo.com/v1/forecast?latitude=${coarse(place.lat)}&longitude=${coarse(place.lon)}&current=${OPEN_METEO_FIELDS}&wind_speed_unit=ms`;
      const res = await fetch(u, { credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      realWx = fromOpenMeteo((await res.json()).current); draw();
    } catch (e) { console.warn("sky: Open-Meteo did not answer; the weather stays estimated", e); realWx = null; status.textContent += " Open-Meteo did not answer, so the weather stays estimated."; }
  }
  $("locate").addEventListener("click", () => {
    if (!navigator.geolocation) { status.textContent = "This browser cannot share a location. Use the time zone instead."; return; }
    status.textContent = "Waiting for your browser.";
    navigator.geolocation.getCurrentPosition(
      (p) => begin({ lat: coarse(p.coords.latitude), lon: coarse(p.coords.longitude) }),
      (e) => { status.textContent = `No location (${e.message || "refused"}). The time zone works without one.`; },
      { enableHighAccuracy: false, maximumAge: 600000, timeout: 15000 });
  });
  $("zone").addEventListener("click", () => begin(placeFromTimeZone()));
  $("weather").addEventListener("change", (e) => { if (e.target.checked) fetchWeather(); else { realWx = null; draw(); } });
  $("sound").addEventListener("click", async (ev) => {
    const btn = ev.currentTarget;
    try {
      if (!sound) sound = (await import("./sound.mjs")).createSound();
      if (sound.playing) { sound.stop(); btn.setAttribute("aria-pressed", "false"); btn.textContent = "Sound"; }
      else { await sound.start(); btn.setAttribute("aria-pressed", "true"); btn.textContent = "Mute"; if (last) draw(800); }
    } catch (e) { console.warn("sky: no sound here", e); status.textContent = "Sound is not available in this browser."; }
  });
  const onOrient = (e) => {
    let h = typeof e.webkitCompassHeading === "number" ? e.webkitCompassHeading : e.absolute && e.alpha != null ? 360 - e.alpha : null;
    if (h == null) return;
    h = (h + (screen.orientation?.angle || 0)) % 360;
    heading = h; const t = performance.now(); if (t - lastHeadingDraw > 200) { lastHeadingDraw = t; draw(400); }
  };
  $("face").addEventListener("click", async (ev) => {
    const b = ev.currentTarget;
    if (b.getAttribute("aria-pressed") === "true") { removeEventListener("deviceorientationabsolute", onOrient); removeEventListener("deviceorientation", onOrient); heading = null; b.setAttribute("aria-pressed", "false"); draw(); return; }
    try { if (typeof DeviceOrientationEvent.requestPermission === "function" && (await DeviceOrientationEvent.requestPermission()) !== "granted") throw new Error("compass permission refused"); }
    catch (e) { status.textContent = `No compass (${e.message}). The view faces the light instead.`; return; }
    addEventListener("ontouchstart" in window && "ondeviceorientationabsolute" in window ? "deviceorientationabsolute" : "deviceorientation", onOrient);
    b.setAttribute("aria-pressed", "true"); if (!place) begin(placeFromTimeZone());
  });
  $("off").addEventListener("click", () => {
    clearInterval(timer); clearTimeout(boltTimer); place = null; heading = null; realWx = null; $("weather").checked = false;
    if (sound?.playing) { sound.stop(); $("sound").setAttribute("aria-pressed", "false"); $("sound").textContent = "Sound"; }
    removeEventListener("deviceorientationabsolute", onOrient); removeEventListener("deviceorientation", onOrient);
    if (themeBefore) root.dataset.theme = themeBefore; else delete root.dataset.theme;
    button.setAttribute("aria-pressed", "false"); $("off").hidden = true; status.textContent = ""; onActive(false); dlg.close();
  });
  button.addEventListener("click", () => dlg.showModal());

  // a planted place and time from the address (?sky=lat,lon&at=ISO&face=deg), for making renders; never a prompt
  const q = new URLSearchParams(location.search);
  if (q.get("sky")) {
    const [lat, lon] = q.get("sky").split(",").map(Number);
    const at = q.get("at") ? new Date(q.get("at")) : null;
    if (PLANTED[q.get("wx")]) planted = q.get("wx");
    if (Number.isFinite(lat) && Number.isFinite(lon)) { if (q.get("face")) heading = Number(q.get("face")); begin({ lat: coarse(lat), lon: coarse(lon), planted: true, at }); }
  }
}
