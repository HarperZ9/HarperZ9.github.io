// system/media-engine/scene.mjs
// Scene and camera requests in the Media IR (kind "media.scene"), shaped so one request drives both
// a live GPU plugin and the raw-native reference core. The camera fields use raw-native's own names
// (its CLI params JSON: width, height, eye, target, up, fovy, prev_eye, prev_target, prev_up), so
// toRawParams() is a rename-free projection and fromRawChannels() reads raw-native's channels.json
// camera block straight back.

import { createMediaDocument, validateMediaDocument } from "../media/ir.js";

export const RAW_PARAMS_KEYS = Object.freeze(["width", "height", "eye", "target", "up", "fovy", "prev_eye", "prev_target", "prev_up"]);

// raw-native's defaults (docs/examples/default-channels.json, v0.2.0).
export const RAW_DEFAULT_CAMERA = Object.freeze({ width: 512, height: 512, eye: [4, 4, 6], target: [0, 1, 0], up: [0, 1, 0], fovy: 0.9 });

const vec3 = (v, name) => {
  if (!Array.isArray(v) || v.length !== 3 || !v.every(Number.isFinite)) throw new TypeError(name + " must be three finite numbers");
  return v.map(Number);
};

export function createSceneRequest(camera = {}, { prev = null, scene = "raw-default" } = {}) {
  const c = { ...RAW_DEFAULT_CAMERA, ...camera };
  const cam = { width: c.width | 0, height: c.height | 0, eye: vec3(c.eye, "eye"), target: vec3(c.target, "target"), up: vec3(c.up, "up"), fovy: +c.fovy };
  if (!(cam.width > 0 && cam.height > 0 && cam.fovy > 0)) throw new RangeError("width, height and fovy must be positive");
  const data = { scene, camera: cam, prev: null };
  if (prev) data.prev = { eye: vec3(prev.eye, "prev.eye"), target: vec3(prev.target || cam.target, "prev.target"), up: vec3(prev.up || cam.up, "prev.up") };
  return createMediaDocument("media.scene", data, { createdAt: new Date(0).toISOString() });
}

// The flat params object raw_native_cli --params accepts.
export function toRawParams(doc) {
  const v = validateMediaDocument(doc);
  if (!v.ok || doc.kind !== "media.scene") throw new TypeError("toRawParams needs a media.scene document");
  const { camera, prev } = doc.data;
  const out = { width: camera.width, height: camera.height, eye: camera.eye, target: camera.target, up: camera.up, fovy: camera.fovy };
  if (prev) Object.assign(out, { prev_eye: prev.eye, prev_target: prev.target, prev_up: prev.up });
  return out;
}

// Read the camera back out of a raw-native channels.json ("raw-channels/1").
export function fromRawChannels(channels) {
  if (!channels || channels.schema !== "raw-channels/1" || !channels.camera) throw new TypeError("not a raw-channels/1 document");
  const { camera, frame } = channels;
  return createSceneRequest({ width: frame.width, height: frame.height, eye: camera.eye, target: camera.target, up: camera.up, fovy: camera.fovy },
    { prev: camera.prev || null });
}
