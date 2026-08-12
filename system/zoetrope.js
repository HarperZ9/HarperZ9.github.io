// zoetrope.js: print geometry for phenakistoscope discs and zoetrope strips.
// Units: millimetres for lengths, degrees for layout angles, radians where named.
// All math is DOM free; drawing functions receive a 2d context and a mm-to-px scale.
// Sources: scratchpad crossings/research/zoetrope.md (S1, S3, S5, S9, S12, S14).

// Practical slot width floor and ceiling for a hand cut paper disc: 1 to 3 mm.
const SLOT_W_MIN = 1;
const SLOT_W_MAX = 3;

// Largest disc that clears a 6 mm margin on both letter and A4: about 198 mm.
export const DISC_DEFAULTS = {
  diameterMM: 190,
  frames: 12,
  slots: 12,
  slotWidthMM: 2,
  slotLengthMM: 25,
  spindleHoleMM: 7.24,
  imageInnerFrac: 0.4,
  imageGapMM: 2,
};

export const STRIP_DEFAULTS = {
  drumDiameterMM: 85,
  frames: 12,
  slots: 12,
  slotWidthMM: 2,
  imageHeightMM: 25,
  overlapTabMM: 10,
};

// Usable strip length per sheet after printer margins.
const SHEET_STRIP_MM = { letter: 267, a4: 285 };

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function checkCount(n, name) {
  if (!Number.isInteger(n) || n < 2) {
    throw new RangeError(name + " must be an integer >= 2, got " + n);
  }
}

// Flash rate law: S slots at R rev/s gives S*R flashes per second.
export function spinRate(fps, slots) {
  checkCount(slots, "slots");
  if (!(fps > 0)) throw new RangeError("fps must be positive");
  const revPerSec = fps / slots;
  return { revPerSec, rpm: 60 * revPerSec };
}

// Drift law: frames equal to slots hold in place; fewer frames drift against
// the spin; more frames drift with it. direction is -1, 0, or +1.
export function frameDrift(frames, slots) {
  checkCount(frames, "frames");
  checkCount(slots, "slots");
  const step = frames - slots;
  return { holds: step === 0, direction: Math.sign(step), framesPerRev: step };
}

// Angular smear while one slot passes the eye: arc angle of the slot opening.
// slotRadiusMM is the radial distance of the slot band from the disc center.
export function smearAngleRad(slotWidthMM, slotRadiusMM) {
  if (!(slotWidthMM > 0) || !(slotRadiusMM > 0)) {
    throw new RangeError("slot width and radius must be positive");
  }
  return slotWidthMM / slotRadiusMM;
}

// Pre-compensation for rotational smear (Plateau and Muybridge practice):
// rotate drawn points against the spin by half the smear angle, scaled.
// Spin is taken as the direction of increasing angle. strength 0 is identity.
export function counterDistortPoint(xMM, yMM, layout, strength) {
  const s = strength === undefined ? 1 : strength;
  const r = Math.hypot(xMM, yMM);
  if (r === 0) return { x: 0, y: 0 };
  const half = smearAngleRad(layout.slotWidthMM, layout.slotInnerRMM) / 2;
  const theta = Math.atan2(yMM, xMM) + half * s;
  return { x: r * Math.cos(theta), y: r * Math.sin(theta) };
}

// Full disc geometry. Slots sit at the rim; the image band sits inside them.
export function discLayout(opts) {
  const o = Object.assign({}, DISC_DEFAULTS, opts || {});
  checkCount(o.frames, "frames");
  checkCount(o.slots, "slots");
  if (!(o.diameterMM > 0)) throw new RangeError("diameterMM must be positive");
  const radiusMM = o.diameterMM / 2;
  const slotWidthMM = clamp(o.slotWidthMM, SLOT_W_MIN, SLOT_W_MAX);
  const slotLengthMM = clamp(o.slotLengthMM, 10, radiusMM * 0.35);
  const slotInnerRMM = radiusMM - slotLengthMM;
  const imageOuterRMM = slotInnerRMM - o.imageGapMM;
  const imageInnerRMM = radiusMM * o.imageInnerFrac;
  if (imageInnerRMM >= imageOuterRMM) {
    throw new RangeError("image band is empty for these dimensions");
  }
  return {
    diameterMM: o.diameterMM,
    radiusMM,
    frames: o.frames,
    slots: o.slots,
    frameAngleDeg: 360 / o.frames,
    slotStepDeg: 360 / o.slots,
    slotWidthMM,
    slotLengthMM,
    slotInnerRMM,
    imageOuterRMM,
    imageInnerRMM,
    spindleHoleMM: o.spindleHoleMM,
    frameCenterAngleDeg: (i) => (i % o.frames) * (360 / o.frames),
    slotCenterAngleDeg: (i) => (i % o.slots) * (360 / o.slots),
    drift: frameDrift(o.frames, o.slots),
    spin: (fps) => spinRate(fps, o.slots),
  };
}

// Strip length equals drum inner circumference; the printed piece adds a tab.
export function stripLayout(opts) {
  const o = Object.assign({}, STRIP_DEFAULTS, opts || {});
  checkCount(o.frames, "frames");
  checkCount(o.slots, "slots");
  if (!(o.drumDiameterMM > 0)) throw new RangeError("drumDiameterMM must be positive");
  const circumferenceMM = Math.PI * o.drumDiameterMM;
  const frameWidthMM = circumferenceMM / o.frames;
  const slotWidthMM = clamp(o.slotWidthMM, SLOT_W_MIN, SLOT_W_MAX);
  // Slot height matches or slightly exceeds image height.
  const slotHeightMM = o.slotHeightMM || o.imageHeightMM + 10;
  // Wall default 90 mm, scaled down for small drums.
  const wallHeightMM = o.wallHeightMM || Math.min(90, Math.round(o.drumDiameterMM * 0.41));
  const slotPitchMM = circumferenceMM / o.slots;
  return {
    drumDiameterMM: o.drumDiameterMM,
    circumferenceMM,
    frames: o.frames,
    slots: o.slots,
    frameWidthMM,
    slotWidthMM,
    slotHeightMM,
    slotPitchMM,
    imageHeightMM: o.imageHeightMM,
    wallHeightMM,
    overlapTabMM: o.overlapTabMM,
    totalLengthMM: circumferenceMM + o.overlapTabMM,
    heightMM: slotHeightMM + o.imageHeightMM,
    frameRectMM: (i) => ({
      x: (i % o.frames) * frameWidthMM,
      y: slotHeightMM,
      w: frameWidthMM,
      h: o.imageHeightMM,
    }),
    slotRectMM: (i) => ({
      x: (i % o.slots) * slotPitchMM + slotPitchMM / 2 - slotWidthMM / 2,
      y: 0,
      w: slotWidthMM,
      h: slotHeightMM,
    }),
    drift: frameDrift(o.frames, o.slots),
    spin: (fps) => spinRate(fps, o.slots),
  };
}

// Base disc for a rolled strip: D = image length / pi.
export function drumDiameterForStrip(imageLengthMM) {
  if (!(imageLengthMM > 0)) throw new RangeError("length must be positive");
  return imageLengthMM / Math.PI;
}

// Usable printed strip length for a sheet format, excluding the overlap tab.
export function stripLengthForSheet(format, sheets) {
  const per = SHEET_STRIP_MM[String(format).toLowerCase()];
  if (!per) throw new RangeError("format must be letter or a4");
  const n = sheets === undefined ? 1 : sheets;
  checkCount(n + 1, "sheets + 1");
  return per * n;
}

function drawRadialSlot(ctx, layout, angleDeg, scale) {
  const a = (angleDeg * Math.PI) / 180;
  const halfW = (layout.slotWidthMM / 2) * scale;
  const r0 = layout.slotInnerRMM * scale;
  const r1 = layout.radiusMM * scale;
  ctx.save();
  ctx.rotate(a);
  ctx.strokeRect(r0, -halfW, r1 - r0, halfW * 2);
  ctx.restore();
}

// Template chrome only: outline, wedge separators, slots, crosshair, spindle.
// ctx origin must already be at the disc center; scale is px per mm.
export function drawDiscTemplate(ctx, layout, scale) {
  const r = layout.radiusMM * scale;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < layout.frames; i += 1) {
    const a = (layout.frameCenterAngleDeg(i) + layout.frameAngleDeg / 2) * (Math.PI / 180);
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * layout.imageInnerRMM * scale, Math.sin(a) * layout.imageInnerRMM * scale);
    ctx.lineTo(Math.cos(a) * layout.imageOuterRMM * scale, Math.sin(a) * layout.imageOuterRMM * scale);
    ctx.stroke();
  }
  for (let i = 0; i < layout.slots; i += 1) {
    drawRadialSlot(ctx, layout, layout.slotCenterAngleDeg(i), scale);
  }
  const c = 4 * scale;
  ctx.beginPath();
  ctx.moveTo(-c, 0); ctx.lineTo(c, 0);
  ctx.moveTo(0, -c); ctx.lineTo(0, c);
  ctx.stroke();
  if (layout.spindleHoleMM > 0) {
    ctx.beginPath();
    ctx.arc(0, 0, (layout.spindleHoleMM / 2) * scale, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// Strip template: slot band boxes on top, frame boxes below, tab at the end.
// ctx origin at the strip's top left corner; scale is px per mm.
export function drawStripTemplate(ctx, layout, scale) {
  ctx.strokeRect(0, 0, layout.totalLengthMM * scale, layout.heightMM * scale);
  for (let i = 0; i < layout.slots; i += 1) {
    const s = layout.slotRectMM(i);
    ctx.strokeRect(s.x * scale, s.y * scale, s.w * scale, s.h * scale);
  }
  for (let i = 0; i < layout.frames; i += 1) {
    const f = layout.frameRectMM(i);
    ctx.strokeRect(f.x * scale, f.y * scale, f.w * scale, f.h * scale);
  }
  const tabX = layout.circumferenceMM * scale;
  ctx.strokeRect(tabX, 0, layout.overlapTabMM * scale, layout.heightMM * scale);
}
