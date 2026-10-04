// node --test system/media-engine/sound-retro.test.mjs
// The Retro instrument's pings and drone on the sound layer: each ping is the same PCM every time
// (pinned), the drone rendered chunk by chunk as it plays is byte-identical to its session scene
// rendered offline, the loudest drone the picture can drive stays inside the interactive class,
// and the receipts verify.
import test from "node:test";
import assert from "node:assert/strict";
import { renderReference, soundReceipt, SOUND_RATE } from "./sound.mjs";
import { pingScene, droneScene, droneChunk, droneState, renderDroneChunk, DRONE } from "./sound-retro.mjs";
import { sha256, verifyReceipt, validateScene, quantizeS16 } from "./contracts.mjs";

const ROOT = 220 * Math.pow(2, 5 / 12);
const PINGS = {
  "chip 0.1": pingScene("chip", 0.1, ROOT),
  "chip 0.9": pingScene("chip", 0.9, ROOT),
  "slider 0.5": pingScene("slider", 0.5, ROOT),
  button: pingScene("button", 0, ROOT),
  bell: pingScene("bell", 0, ROOT),
  click: pingScene("click", 0, ROOT),
  row: pingScene("row", 0.3, ROOT),
};
// The reference PCM of each ping at the root above, and of the drone session below.
const PINNED = {
  "chip 0.1": "00c166701ab190468181be43f4148e5d346bb7ec60059426082c4795abba77eb",
  "chip 0.9": "137b91c36f9cf1c974048a622c6ae63d7f9e4f94f3ec4ce974d9c43618f3ff3c",
  "slider 0.5": "a526606f8ac282ab1d51adaa2c8dc3c54c1307ab0dd806b6adeea391815d5ba4",
  "button": "ab1991e13d24b1b247a52a027c644284c0f681621eeccb446ea1c5847301e275",
  "bell": "a1ed4f6b509ea501b20e021e015adedbb0bcadfebd6f4a98936a34d129da6c20",
  "click": "662959c09fbea1c0fb49c626894b0846628469ebf5f429820e27d86a0ee8dc66",
  "row": "27c7c4a0f8a5f7b371a3c21e684835247c3cfcbdafb4f1c5da966ebce38973a4",
  "drone": "9da5d14574979beb8da29175a67d0d4b9b98ce20298411e86327f0f45a6e9d64",
};

function session(n, root, bandsAt, audibleAt = () => true) {
  const chunks = [];
  for (let k = 0; k < n; k++) chunks.push(droneChunk(bandsAt(k), root, audibleAt(k)));
  return chunks;
}
const DRONE_CHUNKS = session(120, 73.42, (k) => [0, 1, 2, 3, 4, 5].map((i) => 0.5 + 0.5 * Math.sin(k * 0.13 + i)), (k) => k < 100);

test("ping and drone scenes are valid superstack.sound/1 scenes at 48 kHz", () => {
  for (const [name, s] of Object.entries({ ...PINGS, drone: droneScene(DRONE_CHUNKS) })) {
    assert.deepEqual(validateScene(s), [], name);
    assert.equal(s.rate, SOUND_RATE);
  }
});

test("each ping and the drone session render the pinned PCM, the same every time", () => {
  for (const [name, s] of Object.entries({ ...PINGS, drone: droneScene(DRONE_CHUNKS) })) {
    const a = renderReference(s), b = renderReference(JSON.parse(JSON.stringify(s)));
    assert.equal(sha256(a.pcm), sha256(b.pcm), name);
    assert.equal(sha256(a.pcm), PINNED[name], name);
  }
});

test("the drone rendered chunk by chunk, as the live path does, is its scene's reference", () => {
  const ref = renderReference(droneScene(DRONE_CHUNKS));
  const st = droneState(DRONE_CHUNKS[0].r / 1000), buf = new Float64Array(DRONE.chunk);
  const live = new Uint8Array(DRONE_CHUNKS.length * DRONE.chunk * 2);
  DRONE_CHUNKS.forEach((ch, k) => { renderDroneChunk(st, ch, buf, 0); live.set(quantizeS16(buf), k * DRONE.chunk * 2); });
  assert.equal(sha256(live), sha256(ref.pcm));
});

test("the loudest drone the picture can drive, at either end of the root range, is interactive-class", () => {
  for (const root of [55, 103.83]) {
    const { loudness } = renderReference(droneScene(session(80, root, () => [1, 1, 1, 1, 1, 1])));
    assert.equal(loudness.loudness_verdict, "verified", JSON.stringify(loudness));
    assert.ok(loudness.integrated_lufs <= -18 && loudness.peak_dbfs <= -1, JSON.stringify(loudness));
  }
});

test("pings meet the interactive class and every receipt verifies", () => {
  for (const [name, s] of Object.entries({ ...PINGS, drone: droneScene(DRONE_CHUNKS) })) {
    const ref = renderReference(s);
    assert.equal(ref.loudness.loudness_verdict, "verified", name);
    const r = soundReceipt(ref);
    assert.deepEqual(verifyReceipt(r), [], name);
    assert.equal(r.media.access.autoplay, false, name);
  }
});

test("a ping's notes follow the instrument: degree from the value, button is three notes, unknown kinds are a note", () => {
  assert.equal(pingScene("chip", 0.99, ROOT).degree, 5);
  assert.equal(pingScene("chip", -1, ROOT).degree, 0);
  assert.equal(pingScene("button", 0, ROOT).notes.length, 3);
  assert.equal(pingScene("whatever", 0.5, ROOT).ping, "note");
  assert.notEqual(sha256(renderReference(pingScene("chip", 0.1, ROOT)).pcm), sha256(renderReference(pingScene("chip", 0.1, ROOT * 1.01)).pcm));
});
