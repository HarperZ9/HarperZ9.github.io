// First-party procedural field for shared Project Telos pages.
// Synthesizes route-seeded orbit fields, contour ridges, crystal fragments,
// fluid metaballs, iso-contours, ASCII dither, flow traces, pointer wakes, and
// motes, plus the fixture vocabulary: crystal lens apertures, scanline
// halftones, facet planes, groove marble, quadrant CA weaves, and two
// seed-authored neural instruments (a CPPN colour field and a sphere-marched
// neural signed-distance surface). No copied inspiration images, no remote
// textures, and no pretrained weights: the seed derives every network.
import { buildCppn, buildNeuralSdf } from "./neural.js";
import { voxelizeSdf, isoOrder } from "./voxel.js";
import { drawTypeface } from "./typeface.js";
let mounted = false;
let rafId = 0;
const pulses = [];
const pointerState = { x: 0.5, y: 0.5, px: 0.5, py: 0.5, last: 0 };
let lastInteraction = 0;
let lastMovePulse = 0;

function reducedMotion() {
  return !!(window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

function ensureCanvas(doc, id, className, after) {
  let canvas = doc.getElementById(id);
  if (!canvas) {
    canvas = doc.createElement("canvas");
    canvas.id = id;
    canvas.setAttribute("aria-hidden", "true");
    if (after && after.parentNode) after.parentNode.insertBefore(canvas, after.nextSibling);
    else doc.body.prepend(canvas);
  }
  canvas.classList.add(className);
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.display = "block";
  // Safe inline defaults so pages without the shared stylesheets never get an
  // unpositioned full-size canvas pushing their content down. Every styled
  // placement uses the same fixed/inset:0 geometry, so these inline values
  // agree with the stylesheets rather than fighting them.
  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.zIndex = "0";
  canvas.style.pointerEvents = "none";
  return canvas;
}

function hashRoute(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function rand(seed, salt) {
  let x = Math.imul(seed ^ Math.imul(salt + 1013904223, 1664525), 2246822519);
  x ^= x >>> 13;
  x = Math.imul(x, 3266489917);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967295;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toneToRgba(tone, alpha) {
  return `rgba(${tone[0]},${tone[1]},${tone[2]},${alpha})`;
}

function markInteraction(tick = performance.now()) {
  lastInteraction = tick;
}

function addPulse(x, y, tick = performance.now()) {
  pulses.push({
    x: clamp(x, 0, 1),
    y: clamp(y, 0, 1),
    t: tick,
    spin: (x * 19.17 + y * 37.41) % 1,
  });
  while (pulses.length > 10) pulses.shift();
}

function cullPulses(tick) {
  for (let i = pulses.length - 1; i >= 0; i -= 1) {
    if (tick - pulses[i].t > 2100) pulses.splice(i, 1);
  }
  return pulses.length;
}

function routePalette(seed) {
  const palettes = [
    {
      wash: ["rgba(80,196,185,0.16)", "rgba(167,115,255,0.12)", "rgba(239,171,48,0.05)"],
      line: "rgba(80,196,185,0.34)",
      ridge: "rgba(233,226,208,0.10)",
      crystal: "rgba(135,237,74,0.18)",
      spark: "rgba(239,171,48,0.28)",
      fluid: [[80, 196, 185], [167, 115, 255], [239, 171, 48]],
    },
    {
      wash: ["rgba(235,71,143,0.16)", "rgba(80,196,185,0.10)", "rgba(167,115,255,0.08)"],
      line: "rgba(235,71,143,0.30)",
      ridge: "rgba(132,245,255,0.10)",
      crystal: "rgba(239,171,48,0.17)",
      spark: "rgba(135,237,74,0.23)",
      fluid: [[235, 71, 143], [80, 196, 185], [167, 115, 255]],
    },
    {
      wash: ["rgba(239,171,48,0.13)", "rgba(135,237,74,0.10)", "rgba(80,196,185,0.08)"],
      line: "rgba(239,171,48,0.28)",
      ridge: "rgba(235,71,143,0.10)",
      crystal: "rgba(80,196,185,0.18)",
      spark: "rgba(167,115,255,0.24)",
      fluid: [[239, 171, 48], [135, 237, 74], [80, 196, 185]],
    },
  ];
  return palettes[seed % palettes.length];
}

function sizeCanvas(canvas, dpr) {
  const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : null;
  const width = Math.max(1, Math.ceil((rect && rect.width) || window.innerWidth));
  const height = Math.max(1, Math.ceil((rect && rect.height) || window.innerHeight));
  const backingWidth = Math.max(1, Math.round(width * dpr));
  const backingHeight = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
    canvas.width = backingWidth;
    canvas.height = backingHeight;
  }
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
}

function fieldAngle(x, y, tick, seed) {
  const a = Math.sin(x * 0.0058 + tick * 0.00012 + seed * 0.000013);
  const b = Math.cos(y * 0.0075 - tick * 0.00014 + seed * 0.000017);
  const c = Math.sin((x - y) * 0.0036 + tick * 0.00009);
  const d = Math.cos(Math.hypot(x, y) * 0.002 + seed * 0.000021);
  return (a + b + c + d * 0.6) * Math.PI;
}

function drawBackdrop(ctx, width, height, tick, seed, palette) {
  ctx.globalCompositeOperation = "source-over";
  const centerX = width * (0.52 + rand(seed, 8) * 0.35);
  const centerY = height * (0.18 + rand(seed, 13) * 0.34);
  const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(width, height) * 0.86);
  grad.addColorStop(0, palette.wash[0]);
  grad.addColorStop(0.38, palette.wash[1]);
  grad.addColorStop(0.72, palette.wash[2]);
  grad.addColorStop(1, "rgba(2,4,8,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  const sweep = ctx.createLinearGradient(0, 0, width, height);
  sweep.addColorStop(0, "rgba(7,15,20,0.04)");
  sweep.addColorStop(0.52, `rgba(255,255,255,${0.012 + Math.sin(tick * 0.0002) * 0.006})`);
  sweep.addColorStop(1, "rgba(2,4,8,0)");
  ctx.fillStyle = sweep;
  ctx.fillRect(0, 0, width, height);
}

function drawOrbitField(ctx, width, height, tick, seed, palette) {
  const cx = width * (0.58 + rand(seed, 21) * 0.28);
  const cy = height * (0.18 + rand(seed, 22) * 0.36);
  const base = Math.min(width, height) * (0.15 + rand(seed, 23) * 0.12);
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 42; i += 1) {
    const r = base + i * Math.max(8, width * 0.007);
    const wobble = Math.sin(i * 0.73 + tick * 0.00028 + seed * 0.00001) * 0.18;
    const start = (seed % 360) * Math.PI / 180 + i * 0.11 + tick * 0.000055;
    const span = Math.PI * (0.58 + rand(seed, i + 44) * 0.92);
    ctx.beginPath();
    ctx.lineWidth = 0.55 + (i % 7) * 0.12;
    ctx.strokeStyle = i % 5 === 0 ? palette.spark : palette.line;
    ctx.ellipse(cx, cy, r * (1.55 + wobble), r * (0.72 - wobble * 0.24), start * 0.08, start, start + span);
    ctx.stroke();
  }
}

function drawContourRidges(ctx, width, height, tick, seed, palette) {
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = palette.ridge;
  ctx.lineWidth = 1;
  const rows = Math.max(12, Math.floor(height / 58));
  for (let row = -2; row < rows + 3; row += 1) {
    const baseY = (row / rows) * height;
    ctx.beginPath();
    for (let x = -40; x <= width + 40; x += 18) {
      const wave =
        Math.sin(x * 0.010 + row * 0.8 + seed * 0.0002) * 18 +
        Math.cos(x * 0.004 - tick * 0.00018 + row * 1.7) * 28 +
        Math.sin((x + baseY) * 0.006 + tick * 0.0001) * 8;
      const y = baseY + wave;
      if (x === -40) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function drawCrystalFragments(ctx, width, height, tick, seed, palette) {
  ctx.globalCompositeOperation = "lighter";
  const count = Math.max(14, Math.floor(width / 96));
  for (let i = 0; i < count; i += 1) {
    const px = rand(seed, i * 13 + 5) * width;
    const py = rand(seed, i * 17 + 9) * height;
    const scale = 34 + rand(seed, i * 19 + 3) * 128;
    const angle = rand(seed, i * 31 + 1) * Math.PI + tick * 0.000018 * (i % 2 ? 1 : -1);
    const sides = 3 + (i % 3);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle);
    ctx.beginPath();
    for (let n = 0; n < sides; n += 1) {
      const a = (n / sides) * Math.PI * 2;
      const radius = scale * (0.52 + rand(seed, i * 101 + n) * 0.5);
      const x = Math.cos(a) * radius;
      const y = Math.sin(a) * radius;
      if (n === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = i % 4 === 0 ? palette.crystal : "rgba(255,255,255,0.018)";
    ctx.strokeStyle = i % 5 === 0 ? palette.spark : palette.ridge;
    ctx.lineWidth = 1;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function drawFlowTraces(ctx, width, height, tick, seed, palette) {
  ctx.globalCompositeOperation = "lighter";
  const count = Math.max(40, Math.floor(width / 30));
  for (let i = 0; i < count; i += 1) {
    let x = ((i * 97 + seed * 0.031 + tick * 0.004) % (width + 220)) - 110;
    let y = ((i * 53 + seed * 0.017 + Math.sin(tick * 0.0002 + i) * 190) % (height + 180)) - 90;
    ctx.beginPath();
    ctx.lineWidth = 0.7 + (i % 6) * 0.13;
    ctx.strokeStyle = i % 3 === 0 ? palette.line : i % 3 === 1 ? palette.spark : palette.crystal;
    ctx.moveTo(x, y);
    for (let step = 0; step < 56; step += 1) {
      const angle = fieldAngle(x, y, tick, seed);
      x += Math.cos(angle) * 10.5;
      y += Math.sin(angle) * 10.5;
      ctx.lineTo(x, y);
      if (x < -140 || x > width + 140 || y < -140 || y > height + 140) break;
    }
    ctx.stroke();
  }
}

function drawDitheredPosterVeil(ctx, width, height, tick, seed, palette) {
  const tones = palette.fluid || [[132, 245, 255], [167, 115, 255], [239, 171, 48]];
  const cell = Math.max(16, Math.floor(Math.min(width, height) / 72));
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  for (let y = 0, row = 0; y < height; y += cell, row += 1) {
    for (let x = 0, col = 0; x < width; x += cell, col += 1) {
      const nx = x / width;
      const ny = y / height;
      const contour =
        Math.sin(nx * 34 + seed * 0.00011 + tick * 0.00018) +
        Math.cos((nx - ny) * 28 - tick * 0.00012) +
        Math.sin(Math.hypot(nx - 0.72, ny - 0.38) * 42 + seed * 0.00007);
      const level = contour * 0.5 + 0.5;
      if (level < orderedDither(col, row) * 0.9) continue;
      const guard = readingCorridorAlpha(x + cell * 0.5, y + cell * 0.5, width, height);
      const tone = tones[(col + row + seed) % tones.length];
      const alpha = (0.012 + Math.min(0.034, level * 0.024)) * guard;
      const dot = cell * (0.22 + orderedDither(row, col) * 0.42);
      ctx.fillStyle = toneToRgba(tone, alpha);
      ctx.fillRect(x + cell * 0.28, y + cell * 0.28, dot, dot);
    }
  }
  ctx.restore();
}

function orderedDither(x, y) {
  const matrix = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];
  return (matrix[y & 3][x & 3] + 0.5) / 16;
}

function drawHydraTiles(ctx, width, height, tick, seed, palette) {
  const tones = palette.fluid || [[132, 245, 255], [167, 115, 255], [239, 171, 48]];
  const tile = Math.max(118, Math.min(width, height) / 5.8);
  const cols = Math.ceil(width / tile) + 2;
  const rows = Math.ceil(height / tile) + 2;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let row = -1; row < rows; row += 1) {
    for (let col = -1; col < cols; col += 1) {
      const jitter = rand(seed, row * 211 + col * 37);
      const cx = col * tile + (row % 2) * tile * 0.5 + (jitter - 0.5) * tile * 0.16;
      const cy = row * tile * 0.74 + (rand(seed, row * 71 + col * 163) - 0.5) * tile * 0.14;
      const guard = readingCorridorAlpha(cx, cy, width, height);
      const tone = tones[(row + col + tones.length * 8) % tones.length];
      const radius = tile * (0.23 + jitter * 0.16);
      ctx.strokeStyle = toneToRgba(tone, 0.045 * guard);
      ctx.lineWidth = 0.8;
      for (let ring = 0; ring < 3; ring += 1) {
        ctx.beginPath();
        const phase = tick * 0.00008 + ring * 0.21 + seed * 0.00001;
        for (let side = 0; side <= 6; side += 1) {
          const a = phase + (side / 6) * Math.PI * 2;
          const wobble = 1 + Math.sin(side * 1.9 + tick * 0.00017 + row) * 0.11;
          const x = cx + Math.cos(a) * radius * (1 + ring * 0.42) * wobble;
          const y = cy + Math.sin(a) * radius * (0.62 + ring * 0.17) * wobble;
          if (side === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

function drawLampSymmetry(ctx, width, height, tick, seed, palette) {
  const tones = palette.fluid || [[132, 245, 255], [167, 115, 255], [239, 171, 48]];
  const count = Math.max(4, Math.floor(width / 420));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < count; i += 1) {
    const cx = width * (0.58 + rand(seed, i * 31 + 301) * 0.38);
    const cy = height * (0.14 + rand(seed, i * 43 + 307) * 0.74);
    const guard = readingCorridorAlpha(cx, cy, width, height);
    const radius = Math.min(width, height) * (0.045 + rand(seed, i * 47 + 311) * 0.065);
    const tone = tones[i % tones.length];
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tick * 0.000035 * (i % 2 ? -1 : 1) + rand(seed, i * 59 + 317) * Math.PI);
    ctx.strokeStyle = toneToRgba(tone, 0.09 * guard);
    ctx.fillStyle = toneToRgba(tone, 0.018 * guard);
    ctx.lineWidth = 0.75;
    for (let arm = 0; arm < 8; arm += 1) {
      const a = (arm / 8) * Math.PI * 2;
      const inner = radius * 0.22;
      const outer = radius * (1.2 + (arm % 2) * 0.46);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
      ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
      ctx.stroke();
    }
    for (let ring = 0; ring < 3; ring += 1) {
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * (0.62 + ring * 0.35), radius * (0.22 + ring * 0.2), ring * 0.52, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

function metaballCenters(width, height, tick, seed) {
  const count = 5;
  const balls = [];
  for (let i = 0; i < count; i += 1) {
    const phase = seed * 0.00003 + i * 1.713;
    const drift = tick * (0.00007 + i * 0.000011);
    const orbit = 0.18 + rand(seed, i * 29 + 4) * 0.18;
    balls.push({
      x: width * (0.18 + rand(seed, i * 17 + 2) * 0.64) + Math.sin(phase + drift) * width * orbit,
      y: height * (0.16 + rand(seed, i * 19 + 8) * 0.68) + Math.cos(phase * 1.3 - drift * 1.2) * height * orbit * 0.72,
      r: Math.min(width, height) * (0.13 + rand(seed, i * 31 + 11) * 0.18),
      hue: i % 3,
    });
  }
  return balls;
}

function metaballPotential(x, y, balls) {
  let potential = 0;
  for (const ball of balls) {
    const dx = x - ball.x;
    const dy = y - ball.y;
    potential += (ball.r * ball.r) / (dx * dx + dy * dy + ball.r * 18);
  }
  return potential;
}

function metaballGradient(x, y, balls, step) {
  const dx = metaballPotential(x + step, y, balls) - metaballPotential(x - step, y, balls);
  const dy = metaballPotential(x, y + step, balls) - metaballPotential(x, y - step, balls);
  const length = Math.hypot(dx, dy) || 1;
  return { x: dx / length, y: dy / length };
}

function readingCorridorAlpha(x, y, width, height) {
  const nx = x / width;
  const ny = y / height;
  const centerX = width < 760 ? 0.5 : 0.34;
  const centerY = 0.48;
  const spreadX = width < 760 ? 0.68 : 0.46;
  const spreadY = 0.58;
  const distance = Math.hypot((nx - centerX) / spreadX, (ny - centerY) / spreadY);
  return Math.min(1, Math.max(0.26, distance * 0.95));
}

function drawMetaballWashes(ctx, width, height, tick, seed, palette) {
  const balls = metaballCenters(width, height, tick, seed);
  const tones = palette.fluid || [[132, 245, 255], [167, 115, 255], [239, 171, 48]];
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < balls.length; i += 1) {
    const ball = balls[i];
    const tone = tones[i % tones.length];
    const pulse = 0.82 + Math.sin(tick * 0.00024 + i * 1.3) * 0.18;
    const radius = ball.r * (2.05 + rand(seed, i + 120) * 0.85) * pulse;
    const alpha = (0.07 + rand(seed, i + 140) * 0.07) * readingCorridorAlpha(ball.x, ball.y, width, height);
    const grad = ctx.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, radius);
    grad.addColorStop(0, `rgba(${tone[0]},${tone[1]},${tone[2]},${alpha})`);
    grad.addColorStop(0.42, `rgba(${tone[0]},${tone[1]},${tone[2]},${alpha * 0.22})`);
    grad.addColorStop(1, `rgba(${tone[0]},${tone[1]},${tone[2]},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.restore();
}

function drawMetaballContourBands(ctx, width, height, tick, seed, palette) {
  const balls = metaballCenters(width, height, tick, seed);
  const tones = palette.fluid || [[132, 245, 255], [167, 115, 255], [239, 171, 48]];
  const cell = Math.max(14, Math.floor(Math.min(width, height) / 64));
  const thresholds = [0.46, 0.62, 0.82, 1.08];
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  for (let y = cell * 0.5, row = 0; y < height; y += cell, row += 1) {
    for (let x = cell * 0.5, col = 0; x < width; x += cell, col += 1) {
      const potential = metaballPotential(x, y, balls);
      for (let ti = 0; ti < thresholds.length; ti += 1) {
        const threshold = thresholds[ti];
        const band = Math.abs(potential - threshold);
        const dither = orderedDither(col + ti, row);
        if (band > 0.034 + dither * 0.018) continue;
        const grad = metaballGradient(x, y, balls, cell * 0.36);
        const tangentX = -grad.y;
        const tangentY = grad.x;
        const guard = readingCorridorAlpha(x, y, width, height);
        const tone = tones[(ti + col + row) % tones.length];
        const alpha = (0.035 + (threshold - band) * 0.06) * guard;
        const span = cell * (0.46 + dither * 0.62);
        const jitter = Math.sin(tick * 0.00016 + seed * 0.00001 + row * 0.7 + col * 0.33) * cell * 0.18;
        ctx.beginPath();
        ctx.lineWidth = 0.65 + ti * 0.12;
        ctx.strokeStyle = toneToRgba(tone, alpha);
        ctx.moveTo(x - tangentX * span + grad.x * jitter, y - tangentY * span + grad.y * jitter);
        ctx.lineTo(x + tangentX * span + grad.x * jitter, y + tangentY * span + grad.y * jitter);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

function drawAsciiMetaballField(ctx, width, height, tick, seed, palette) {
  const balls = metaballCenters(width, height, tick, seed);
  const cell = Math.max(24, Math.floor(Math.min(width, height) / 38));
  const chars = " .,:;<>+*#%@";
  const tones = palette.fluid || [[132, 245, 255], [135, 237, 74], [239, 171, 48]];
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${Math.floor(cell * 0.78)}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  for (let y = cell * 0.5, row = 0; y < height; y += cell, row += 1) {
    for (let x = cell * 0.5, col = 0; x < width; x += cell, col += 1) {
      const curl = Math.sin((x + seed) * 0.004 + tick * 0.00012) * Math.cos((y - seed) * 0.004 - tick * 0.0001);
      const potential = metaballPotential(x, y, balls) + curl * 0.08;
      const threshold = orderedDither(col, row) * 0.42;
      const level = Math.max(0, Math.min(1, potential - threshold));
      if (level < 0.16) continue;
      const char = chars[Math.min(chars.length - 1, Math.floor(level * chars.length))];
      const guard = readingCorridorAlpha(x, y, width, height);
      const alpha = Math.min(0.34, 0.05 + level * 0.21) * guard;
      const tone = tones[(col + row) % tones.length];
      ctx.fillStyle = `rgba(${tone[0]},${tone[1]},${tone[2]},${alpha})`;
      ctx.fillText(char, x, y + Math.sin(tick * 0.0003 + col * 0.4) * cell * 0.08);
    }
  }
  ctx.restore();
}

function drawFluidCurl(ctx, width, height, tick, seed, palette) {
  const balls = metaballCenters(width, height, tick, seed);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 34; i += 1) {
    const ball = balls[i % balls.length];
    let x = ball.x + Math.cos(i * 1.41 + tick * 0.00013) * ball.r * (0.28 + rand(seed, i + 70));
    let y = ball.y + Math.sin(i * 1.17 - tick * 0.00011) * ball.r * (0.28 + rand(seed, i + 90));
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let step = 0; step < 46; step += 1) {
      const influence = metaballPotential(x, y, balls);
      const angle =
        fieldAngle(x, y, tick, seed) * 0.42 +
        Math.atan2(y - ball.y, x - ball.x) +
        Math.PI * (0.34 + influence * 0.08);
      const stride = 5.2 + influence * 1.8;
      x += Math.cos(angle) * stride;
      y += Math.sin(angle) * stride;
      ctx.lineTo(x, y);
    }
    ctx.lineWidth = 0.55 + (i % 5) * 0.14;
    ctx.strokeStyle = i % 4 === 0 ? palette.spark : i % 4 === 1 ? palette.crystal : palette.line;
    ctx.stroke();
  }
  ctx.restore();
}

function drawPointerWake(ctx, width, height, tick, seed, palette) {
  const age = tick - pointerState.last;
  if (age < 0 || age > 1600) return;
  const tones = palette.fluid || [[132, 245, 255], [167, 115, 255], [239, 171, 48]];
  const x = pointerState.x * width;
  const y = pointerState.y * height;
  const dx = (pointerState.x - pointerState.px) * width;
  const dy = (pointerState.y - pointerState.py) * height;
  const speed = clamp(Math.hypot(dx, dy) / Math.max(width, height), 0, 0.08);
  const fade = Math.max(0, 1 - age / 1600) * (0.55 + speed * 7);
  const radius = Math.min(width, height) * (0.08 + speed * 2.6);
  const guard = readingCorridorAlpha(x, y, width, height);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  for (let arm = 0; arm < 28; arm += 1) {
    const tone = tones[(arm + seed) % tones.length];
    const base = (arm / 28) * Math.PI * 2 + tick * 0.00035;
    const spiral = radius * (0.34 + (arm % 7) * 0.11);
    const sx = x + Math.cos(base) * spiral;
    const sy = y + Math.sin(base) * spiral * 0.72;
    ctx.beginPath();
    ctx.lineWidth = 0.8 + (arm % 4) * 0.18;
    ctx.strokeStyle = toneToRgba(tone, 0.055 * fade * guard);
    ctx.moveTo(sx, sy);
    for (let step = 0; step < 18; step += 1) {
      const local = step / 18;
      const a = fieldAngle(sx + step * 4, sy - step * 2, tick, seed) + base * 0.22 + local * 1.7;
      ctx.lineTo(
        sx + Math.cos(a) * radius * local * 0.9 + dx * local * 0.38,
        sy + Math.sin(a) * radius * local * 0.58 + dy * local * 0.38,
      );
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawInteractionShockwaves(ctx, width, height, tick, seed, palette) {
  if (!pulses.length) return;
  const tones = palette.fluid || [[132, 245, 255], [167, 115, 255], [239, 171, 48]];
  const scale = width / Math.max(1, window.innerWidth || width);
  const chars = "+*#<>.:";
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${Math.max(9, Math.floor(12 * scale))}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  for (let i = 0; i < pulses.length; i += 1) {
    const pulse = pulses[i];
    const age = tick - pulse.t;
    if (age < 0 || age > 2100) continue;
    const x = pulse.x * width;
    const y = pulse.y * height;
    const tone = tones[(i + seed) % tones.length];
    const guard = readingCorridorAlpha(x, y, width, height);
    const fade = Math.max(0, 1 - age / 2100) * guard;
    const radius = (age * 0.23 + 24) * scale;
    ctx.strokeStyle = toneToRgba(tone, 0.22 * fade);
    ctx.lineWidth = Math.max(1, 1.2 * scale);
    for (let ring = 0; ring < 3; ring += 1) {
      ctx.beginPath();
      ctx.arc(x, y, radius + ring * 24 * scale, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = toneToRgba(tone, 0.18 * fade);
    const marks = 18;
    for (let mark = 0; mark < marks; mark += 1) {
      const a = pulse.spin * Math.PI * 2 + (mark / marks) * Math.PI * 2 + age * 0.0008;
      const dither = orderedDither(mark, i) * 22 * scale;
      const px = x + Math.cos(a) * (radius + dither);
      const py = y + Math.sin(a) * (radius * 0.72 + dither);
      ctx.fillText(chars[(mark + i) % chars.length], px, py);
    }
  }
  ctx.restore();
}

function drawField(ctx, width, height, tick, seed, palette) {
  ctx.clearRect(0, 0, width, height);
  drawBackdrop(ctx, width, height, tick, seed, palette);
  drawDitheredPosterVeil(ctx, width, height, tick, seed, palette);
  drawMetaballWashes(ctx, width, height, tick, seed, palette);
  drawMetaballContourBands(ctx, width, height, tick, seed, palette);
  drawAsciiMetaballField(ctx, width, height, tick, seed, palette);
  drawFluidCurl(ctx, width, height, tick, seed, palette);
  drawHydraTiles(ctx, width, height, tick, seed, palette);
  drawLampSymmetry(ctx, width, height, tick, seed, palette);
  drawPointerWake(ctx, width, height, tick, seed, palette);
  drawInteractionShockwaves(ctx, width, height, tick, seed, palette);
  drawContourRidges(ctx, width, height, tick, seed, palette);
  drawCrystalFragments(ctx, width, height, tick, seed, palette);
  drawOrbitField(ctx, width, height, tick, seed, palette);
  drawFlowTraces(ctx, width, height, tick, seed, palette);
}

function drawMotes(ctx, width, height, tick, seed, palette) {
  ctx.clearRect(0, 0, width, height);
  ctx.globalCompositeOperation = "lighter";
  const count = Math.max(52, Math.floor(width / 16));
  for (let i = 0; i < count; i += 1) {
    const px = (Math.sin(seed * 0.001 + i * 12.989 + tick * 0.00007) * 0.5 + 0.5) * width;
    const py = (Math.cos(seed * 0.0017 + i * 78.233 + tick * 0.00011) * 0.5 + 0.5) * height;
    const r = 0.8 + ((i * 7 + seed) % 11) * 0.12;
    ctx.beginPath();
    ctx.fillStyle = i % 5 === 0 ? palette.spark : i % 3 === 0 ? palette.crystal : palette.line;
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function startEngine(scene, motes) {
  const seed = hashRoute(window.location.pathname || "telos");
  const palette = routePalette(seed);
  const sceneCtx = scene.getContext("2d", { alpha: true });
  const motesCtx = motes ? motes.getContext("2d", { alpha: true }) : null;
  const still = reducedMotion();
  let lastRendered = 0;
  lastInteraction = performance.now();

  if (!sceneCtx) {
    document.documentElement.classList.add("generative-field-failed");
    return false;
  }

  const render = (tick = 0) => {
    const livePulseCount = cullPulses(tick);
    const active = tick - lastInteraction < 1400 || livePulseCount > 0;
    const frameGap = active ? 28 : 82;
    if (!still && tick - lastRendered < frameGap) {
      rafId = window.requestAnimationFrame(render);
      return;
    }
    lastRendered = tick;
    const dpr = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));
    sizeCanvas(scene, dpr);
    if (motes) sizeCanvas(motes, dpr);
    const width = scene.width;
    const height = scene.height;
    sceneCtx.setTransform(1, 0, 0, 1, 0, 0);
    drawField(sceneCtx, width, height, tick, seed, palette);
    if (motesCtx && motes) {
      motesCtx.setTransform(1, 0, 0, 1, 0, 0);
      drawMotes(motesCtx, motes.width, motes.height, tick, seed, palette);
    }
    if (!still && !document.hidden) rafId = window.requestAnimationFrame(render);
  };

  const updatePointer = (event) => {
    pointerState.px = pointerState.x;
    pointerState.py = pointerState.y;
    pointerState.x = clamp(event.clientX / Math.max(1, window.innerWidth), 0, 1);
    pointerState.y = clamp(event.clientY / Math.max(1, window.innerHeight), 0, 1);
    pointerState.last = performance.now();
    markInteraction(pointerState.last);
    const moved = Math.hypot(pointerState.x - pointerState.px, pointerState.y - pointerState.py);
    if (moved > 0.035 && pointerState.last - lastMovePulse > 240) {
      addPulse(pointerState.x, pointerState.y, pointerState.last);
      lastMovePulse = pointerState.last;
    }
  };
  const onPointerMove = (event) => updatePointer(event);
  const onPointerDown = (event) => {
    updatePointer(event);
    addPulse(pointerState.x, pointerState.y, pointerState.last);
  };
  // Scroll deliberately does NOT mark interaction: flipping to the fast redraw
  // cadence exactly when the main thread is busiest (scrolling) costs frames
  // where they hurt most. The idle cadence keeps drifting underneath.
  const onKeyDown = () => {
    const tick = performance.now();
    addPulse(0.5 + Math.sin(tick * 0.003 + seed) * 0.18, 0.52 + Math.cos(tick * 0.002 + seed) * 0.12, tick);
    markInteraction(tick);
  };

  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerdown", onPointerDown, { passive: true });
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("resize", () => render(performance.now()), { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    } else if (!rafId && !still) {
      rafId = window.requestAnimationFrame(render);
    }
  });
  render(performance.now());
  return true;
}

export function mountGenerativeField(doc = document) {
  if (typeof window === "undefined" || !doc || !doc.body) return Promise.resolve(false);
  if (doc.body.dataset.noGenerativeField === "true") return Promise.resolve(false);
  if (mounted) return Promise.resolve(true);

  const scene = ensureCanvas(doc, "gl", "generative-field-canvas");
  const motes = reducedMotion() ? null : ensureCanvas(doc, "motes", "generative-motes-canvas", scene);

  doc.body.classList.add("generative-host");
  doc.documentElement.classList.remove("generative-field-failed");
  doc.documentElement.classList.add("generative-field-ready");
  mounted = startEngine(scene, motes);
  return Promise.resolve(mounted);
}

/* ---------------------------------------------------------------------------
   Fixture layers (2026-07-09): a fused Supergraphic Ultramodern x Crystal x
   Neoexpressionist vocabulary, synthesized as first-party drawing code from
   the operator's inspiration corpus (no image is copied, traced, or embedded).
   These are specimen-first layers, registered in SPECIMEN_LAYERS below and
   rendered one-shot by renderSpecimen, so modest per-call allocation is fine
   and no reading-corridor guard applies: in a fixture tile the drawing IS the
   exhibit, not a backdrop under text. All of them are deterministic from
   (seed, tick) alone and never touch window or document.
--------------------------------------------------------------------------- */

function lensBandTone(t, maroonAt) {
  // Horizon curve for the crystal sheet: ice white into cyan into a deep
  // blue floor, with one hard dark maroon shadow band cut across the stack.
  if (Math.abs(t - maroonAt) < 0.045) return [64, 10, 34];
  if (t < 0.3) {
    const k = t / 0.3;
    return [Math.round(238 - k * 98), Math.round(250 - k * 42), Math.round(252 - k * 8)];
  }
  if (t < 0.64) {
    const k = (t - 0.3) / 0.34;
    return [Math.round(140 - k * 102), Math.round(208 - k * 130), Math.round(244 - k * 58)];
  }
  const k = (t - 0.64) / 0.36;
  return [Math.round(38 + k * 96), Math.round(78 + k * 138), Math.round(186 + k * 62)];
}

function lensHorizonBands(ctx, width, y0, spanH, seed, salt, phase, alphaScale) {
  const bands = Math.max(20, Math.round(spanH / 6));
  const maroonAt = 0.52 + rand(seed, salt + 811) * 0.2;
  const bandH = spanH / bands;
  for (let i = 0; i < bands; i += 1) {
    const t = i / (bands - 1);
    const tone = lensBandTone(t, maroonAt);
    const shimmer = 0.5 + Math.sin(t * 8.2 + phase + rand(seed, salt + 17) * 6.28) * 0.5;
    ctx.fillStyle = toneToRgba(tone, (0.14 + shimmer * 0.2) * alphaScale);
    ctx.fillRect(0, y0 + i * bandH, width, bandH + 1);
  }
}

function lensAperture(ctx, width, seed, salt, phase, cx, cy, r) {
  // Refracted interior: the same horizon stack, re-banded at the aperture's
  // own scale so the glass visibly bends the horizon behind it.
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  lensHorizonBands(ctx, width, cy - r, r * 2, seed, salt, phase + 2.1, 1.05);
  ctx.restore();
  // Hard specular rim: one bright thick arc at the light angle, one thin
  // full ring, and one deep blue counter-arc on the shadow side.
  const lightA = rand(seed, salt + 5) * Math.PI * 2;
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(244,252,255,0.85)";
  ctx.lineWidth = Math.max(1.4, r * 0.045);
  ctx.beginPath();
  ctx.arc(cx, cy, r, lightA - 0.9, lightA + 0.7);
  ctx.stroke();
  ctx.strokeStyle = "rgba(210,240,250,0.5)";
  ctx.lineWidth = Math.max(0.8, r * 0.014);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(24,44,120,0.55)";
  ctx.lineWidth = Math.max(1, r * 0.03);
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.965, lightA + Math.PI - 0.8, lightA + Math.PI + 0.9);
  ctx.stroke();
}

function drawCrystalLens(ctx, width, height, tick, seed, palette) {
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  const phase = tick * 0.00004;
  const base = Math.min(width, height);
  lensHorizonBands(ctx, width, 0, height, seed, 400, phase, 0.6);
  // Faceted chords: hard straight cuts across the glass sheet.
  ctx.lineCap = "butt";
  for (let i = 0; i < 4; i += 1) {
    ctx.strokeStyle = `rgba(228,246,252,${0.12 + rand(seed, i + 405) * 0.12})`;
    ctx.lineWidth = Math.max(1, base * 0.0035);
    ctx.beginPath();
    ctx.moveTo(rand(seed, i * 61 + 402) * width, -2);
    ctx.lineTo(rand(seed, i * 67 + 403) * width, height + 2);
    ctx.stroke();
  }
  // Overlapping circular apertures cut into the faceted glass.
  const count = 3 + (seed % 2);
  for (let i = 0; i < count; i += 1) {
    const cx = width * (0.18 + rand(seed, i * 41 + 421) * 0.64);
    const cy = height * (0.2 + rand(seed, i * 47 + 431) * 0.6);
    const r = base * (0.16 + rand(seed, i * 53 + 441) * 0.2);
    lensAperture(ctx, width, seed, 450 + i * 97, phase + i, cx, cy, r);
  }
  // One palette glint so the route color still signs the sheet.
  ctx.fillStyle = palette.spark;
  ctx.beginPath();
  ctx.arc(width * (0.3 + rand(seed, 471) * 0.4), height * (0.3 + rand(seed, 477) * 0.4),
    Math.max(2, base * 0.012), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawScanlineHalftone(ctx, width, height, tick, seed, palette) {
  // One iconic disc built from dashed horizontal scanlines; the dash length
  // carries the tone. Two working colors plus one accent, plotter restraint.
  const tones = palette.fluid || [[132, 245, 255], [167, 115, 255], [239, 171, 48]];
  const base = Math.min(width, height);
  const step = Math.max(3, Math.round(base / 88));
  const rowH = Math.max(1, step * 0.44);
  const cx = width * (0.4 + rand(seed, 501) * 0.2);
  const cy = height * (0.42 + rand(seed, 503) * 0.16);
  const radius = base * (0.26 + rand(seed, 505) * 0.12);
  const lightA = rand(seed, 507) * Math.PI * 2;
  const lx = Math.cos(lightA);
  const ly = Math.sin(lightA);
  const grooves = 7 + (seed % 5);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let y = step * 0.5, row = 0; y < height; y += step, row += 1) {
    const dy = (y - cy) / radius;
    if (row % 3 === 0) {
      // Sparse ambient scanlines keep the ground alive without stealing tone.
      ctx.fillStyle = toneToRgba(tones[1], 0.02);
      ctx.fillRect(0, y - rowH * 0.5, width, Math.max(1, rowH * 0.5));
    }
    if (Math.abs(dy) >= 1) continue;
    const half = Math.sqrt(1 - dy * dy) * radius;
    const ink = tones[row % 9 === 0 ? 2 : 0];
    const xEnd = Math.min(width, cx + half);
    let x = Math.max(0, cx - half);
    let guard = 0;
    while (x < xEnd && guard < 320) {
      guard += 1;
      const nx = (x - cx) / radius;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - dy * dy));
      const lambert = Math.max(0, nx * lx + dy * ly);
      const band = 0.5 + Math.sin(dy * grooves + nx * 2.2 + tick * 0.00002) * 0.5;
      const tone = clamp(nz * 0.42 + lambert * 0.48 + band * 0.24, 0, 1);
      const dash = step * (0.5 + tone * 2.8);
      ctx.fillStyle = toneToRgba(ink, 0.08 + tone * 0.5);
      ctx.fillRect(x, y - rowH * 0.5, Math.min(dash, xEnd - x), rowH);
      x += dash + step * (0.35 + (1 - tone) * 2.3);
    }
  }
  // One thin orbital ellipse: the plotter's signature pass.
  ctx.strokeStyle = toneToRgba(tones[2], 0.5);
  ctx.lineWidth = Math.max(1, base * 0.0028);
  ctx.beginPath();
  ctx.ellipse(cx, cy, radius * 1.28, radius * 0.44, lightA * 0.35, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function facetShardPath(ctx, seed, salt, cx, cy, size) {
  const sides = 4 + (salt % 2);
  ctx.beginPath();
  for (let n = 0; n < sides; n += 1) {
    const a = rand(seed, salt + n * 7) * 0.9 + (n / sides) * Math.PI * 2;
    const radius = size * (0.45 + rand(seed, salt + n * 11 + 3) * 0.6);
    const x = cx + Math.cos(a) * radius;
    const y = cy + Math.sin(a) * radius * 0.86;
    if (n === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function facetHatch(ctx, cx, cy, size, angle, alpha) {
  // Dense parallel texture clipped to the current shard path.
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = `rgba(214,220,226,${alpha})`;
  ctx.lineWidth = 0.7;
  const span = size * 1.9;
  const gap = Math.max(3, size / 9);
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  for (let o = -span; o <= span; o += gap) {
    ctx.beginPath();
    ctx.moveTo(cx - dx * span - dy * o, cy - dy * span + dx * o);
    ctx.lineTo(cx + dx * span - dy * o, cy + dy * span + dx * o);
    ctx.stroke();
  }
  ctx.restore();
}

function facetAccentStroke(ctx, width, height, tick, seed, base) {
  // EXACTLY ONE hot stroke per composition: the neoexpressionist gash. Keep
  // it single; a second accent would flatten the whole grammar of the layer.
  ctx.beginPath();
  let x = width * (0.24 + rand(seed, 661) * 0.5);
  let y = height * (0.14 + rand(seed, 667) * 0.3);
  ctx.moveTo(x, y);
  for (let s = 1; s <= 3; s += 1) {
    x += (rand(seed, 670 + s * 7) - 0.42) * width * 0.3;
    y += (0.14 + rand(seed, 673 + s * 11) * 0.2) * height + Math.sin(tick * 0.0001 + s) * base * 0.004;
    ctx.lineTo(x, y);
  }
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(206,38,24,0.82)";
  ctx.lineWidth = Math.max(2.5, base * 0.014);
  ctx.stroke();
}

function drawFacetPlanes(ctx, width, height, tick, seed, palette) {
  const base = Math.min(width, height);
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  // Near-monochrome angular shards over the dark ground.
  const count = 9 + (seed % 4);
  for (let i = 0; i < count; i += 1) {
    const cx = rand(seed, i * 29 + 601) * width;
    const cy = rand(seed, i * 31 + 607) * height;
    const size = base * (0.1 + rand(seed, i * 37 + 613) * 0.24);
    const grey = 150 + Math.round(rand(seed, i * 41 + 617) * 80);
    facetShardPath(ctx, seed, i * 101 + 620, cx, cy, size);
    ctx.fillStyle = `rgba(${grey},${grey + 4},${grey + 10},${0.05 + rand(seed, i + 627) * 0.08})`;
    ctx.strokeStyle = "rgba(226,230,236,0.22)";
    ctx.lineWidth = Math.max(1, base * 0.002);
    ctx.fill();
    ctx.stroke();
    if (i % 3 === 0) facetHatch(ctx, cx, cy, size, rand(seed, i + 631) * Math.PI, 0.07);
  }
  // Hard diagonal light cones: flat wedges, no soft gradient edge.
  const cones = 1 + (seed % 2);
  for (let i = 0; i < cones; i += 1) {
    const ax = width * (0.16 + rand(seed, i * 43 + 641) * 0.68);
    const spread = base * (0.16 + rand(seed, i * 47 + 647) * 0.2);
    const drift = (rand(seed, i * 53 + 653) - 0.5) * width * 0.7;
    ctx.beginPath();
    ctx.moveTo(ax, -4);
    ctx.lineTo(ax + drift - spread, height + 4);
    ctx.lineTo(ax + drift + spread, height + 4);
    ctx.closePath();
    ctx.fillStyle = `rgba(238,242,246,${0.08 + rand(seed, i + 659) * 0.05})`;
    ctx.fill();
  }
  facetAccentStroke(ctx, width, height, tick, seed, base);
  ctx.restore();
}

const GROOVE_RAINBOW = [
  [255, 92, 96], [255, 176, 64], [246, 240, 120],
  [122, 232, 140], [96, 198, 255], [186, 136, 255],
];

function grooveAngle(x, y, tick, seed, swirlX, swirlY) {
  // A curl field: the shared fieldAngle noise plus circulation around one
  // seed-picked swirl center, so the grooves bundle instead of wandering.
  return fieldAngle(x * 1.7, y * 1.7, tick, seed) * 0.55 +
    Math.atan2(y - swirlY, x - swirlX) + Math.PI * 0.52;
}

function grooveComb(ctx, xs, ys, base, rainbow, bundle, seed) {
  // Comb the traced spine: parallel offset strokes share one path. Exactly
  // one bundle per composition is the narrow rainbow shear ribbon; the rest
  // stay pale grooves. Drawn strokes, never CSS gradients.
  const teeth = rainbow ? GROOVE_RAINBOW.length : 5 + (bundle % 3);
  const spacing = base * (rainbow ? 0.005 : 0.0065);
  for (let k = 0; k < teeth; k += 1) {
    const off = (k - (teeth - 1) / 2) * spacing;
    ctx.beginPath();
    ctx.lineWidth = rainbow ? Math.max(1, base * 0.0028) : Math.max(0.9, base * 0.0026);
    ctx.strokeStyle = rainbow
      ? toneToRgba(GROOVE_RAINBOW[k], 0.62)
      : `rgba(236,228,248,${0.17 + ((k + seed) % 2) * 0.07})`;
    for (let s = 0; s < xs.length; s += 1) {
      const tx = s ? xs[s] - xs[s - 1] : xs[1] - xs[0];
      const ty = s ? ys[s] - ys[s - 1] : ys[1] - ys[0];
      const len = Math.hypot(tx, ty) || 1;
      const x = xs[s] - (ty / len) * off;
      const y = ys[s] + (tx / len) * off;
      if (s === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function drawGrooveMarble(ctx, width, height, tick, seed, palette) {
  const base = Math.min(width, height);
  ctx.save();
  // Violet/plum ground wash, uneven on purpose.
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(44,18,58,0.5)";
  ctx.fillRect(0, 0, width, height);
  for (let i = 0; i < 3; i += 1) {
    ctx.fillStyle = `rgba(${26 + i * 14},${8 + i * 5},${40 + i * 12},0.22)`;
    ctx.beginPath();
    ctx.arc(width * rand(seed, 703 + i * 9), height * rand(seed, 707 + i * 9),
      base * (0.3 + i * 0.16), 0, Math.PI * 2);
    ctx.fill();
  }
  // Bundled comb streamlines along the curl field.
  const swirlX = width * (0.34 + rand(seed, 711) * 0.32);
  const swirlY = height * (0.34 + rand(seed, 713) * 0.32);
  const bundles = 13 + (seed % 4);
  const rainbowAt = seed % bundles;
  const stride = base * 0.014;
  const steps = 52;
  const xs = new Array(steps);
  const ys = new Array(steps);
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  for (let b = 0; b < bundles; b += 1) {
    let x = width * rand(seed, b * 17 + 721);
    let y = height * rand(seed, b * 19 + 727);
    for (let s = 0; s < steps; s += 1) {
      xs[s] = x;
      ys[s] = y;
      const a = grooveAngle(x, y, tick, seed, swirlX, swirlY);
      x += Math.cos(a) * stride;
      y += Math.sin(a) * stride;
    }
    grooveComb(ctx, xs, ys, base, b === rainbowAt, b, seed);
  }
  ctx.restore();
}

function caPane(seed, salt, rule, lanes, gens, plot, pair) {
  // Elementary 1D automaton with wrap-around lanes: two row buffers, no grid
  // retained. Alive cells land through plot() as a two-tone weave, dithered
  // with the same ordered matrix the poster veil uses.
  let cur = new Uint8Array(lanes);
  let next = new Uint8Array(lanes);
  for (let i = 0; i < lanes; i += 1) cur[i] = rand(seed, salt + i) < 0.44 ? 1 : 0;
  for (let g = 0; g < gens; g += 1) {
    for (let i = 0; i < lanes; i += 1) {
      if (cur[i]) plot(i, g, toneToRgba(pair[(i + g) & 1], 0.21 + orderedDither(i, g) * 0.1));
      const l = cur[(i + lanes - 1) % lanes];
      const r = cur[(i + 1) % lanes];
      next[i] = (rule >> ((l << 2) | (cur[i] << 1) | r)) & 1;
    }
    const swap = cur;
    cur = next;
    next = swap;
  }
}

function caSeam(ctx, width, height, cx, cy, cell, tones) {
  // Hard quadrant boundaries: a dark cut with a stitched bright seam.
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(3,5,9,0.62)";
  ctx.fillRect(cx - cell * 0.5, 0, cell, height);
  ctx.fillRect(0, cy - cell * 0.5, width, cell);
  ctx.fillStyle = toneToRgba(tones[0], 0.5);
  for (let y = 0; y < height; y += cell * 3) ctx.fillRect(cx - 1, y, 2, cell * 1.4);
  for (let x = 0; x < width; x += cell * 3) ctx.fillRect(x, cy - 1, cell * 1.4, 2);
}

function drawCaQuadrant(ctx, width, height, tick, seed, palette) {
  // Quadrant-composed two-tone CA weave: four elementary automata march away
  // from a seed-shifted cross, one rule and orientation per quadrant, in the
  // pinwheel spirit of the engine's hydra tiles.
  const tones = palette.fluid || [[132, 245, 255], [167, 115, 255], [239, 171, 48]];
  const cell = Math.max(3, Math.round(Math.min(width, height) / 92));
  const cx = Math.round(width * (0.42 + rand(seed, 901) * 0.16));
  const cy = Math.round(height * (0.42 + rand(seed, 907) * 0.16));
  const dot = Math.max(1, cell - 1);
  const rules = [90, 110, 30, 150];
  const cols = (span) => Math.max(1, Math.ceil(span / cell));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const paint = (fx, fy) => (i, g, style) => {
    ctx.fillStyle = style;
    ctx.fillRect(fx(i, g), fy(i, g), dot, dot);
  };
  const panes = [
    [cols(cx), cols(cy), paint((i) => i * cell, (i, g) => cy - (g + 1) * cell)],
    [cols(cy), cols(width - cx), paint((i, g) => cx + g * cell, (i) => i * cell)],
    [cols(width - cx), cols(height - cy), paint((i) => cx + i * cell, (i, g) => cy + g * cell)],
    [cols(height - cy), cols(cx), paint((i, g) => cx - (g + 1) * cell, (i) => cy + i * cell)],
  ];
  for (let q = 0; q < panes.length; q += 1) {
    const [lanes, gens, plot] = panes[q];
    const pair = [tones[q % tones.length], tones[(q + 1) % tones.length]];
    caPane(seed, q * 5077 + 911, rules[(q + seed) % rules.length], lanes, gens, plot, pair);
  }
  caSeam(ctx, width, height, cx, cy, cell, tones);
  ctx.restore();
}

/* ---------------------------------------------------------------------------
   WAVE 2 (2026-07-09): plate-grade layers from the full inspiration corpus.
   Art-mag register: these draw at full-bleed scale, set their own grounds
   where the family demands it, and stay one-shot (no rAF, no listeners).
   Seeded mode is byte-stable; seed "live" draws a true-random one-off.
--------------------------------------------------------------------------- */

const VEIL_TONES = [[190, 235, 255], [255, 214, 150], [255, 122, 146], [236, 244, 255]];

function veilRibbon(ctx, width, height, rnd, salt, tone, alphaScale, dark) {
  const edge = Math.floor(rnd(salt) * 4);
  const p0 = edge === 0 ? [rnd(salt + 1) * width, -height * 0.06]
    : edge === 1 ? [width * 1.06, rnd(salt + 1) * height]
    : edge === 2 ? [rnd(salt + 1) * width, height * 1.06]
    : [-width * 0.06, rnd(salt + 1) * height];
  const p2 = [width * (0.12 + rnd(salt + 2) * 0.76), height * (0.1 + rnd(salt + 3) * 0.8)];
  const p1 = [
    (p0[0] + p2[0]) / 2 + (rnd(salt + 4) - 0.5) * width * 0.6,
    (p0[1] + p2[1]) / 2 + (rnd(salt + 5) - 0.5) * height * 0.6,
  ];
  const k = Math.max(1, Math.min(2.4, width / 900));
  const strokes = 26 + Math.floor(rnd(salt + 6) * 26);
  const nx = -(p2[1] - p0[1]);
  const ny = p2[0] - p0[0];
  const nl = Math.max(1, Math.hypot(nx, ny));
  for (let s = 0; s < strokes; s += 1) {
    const off = (s - strokes / 2) * (0.7 + rnd(salt + 7) * 0.8) * k;
    const fan = (s - strokes / 2) * 0.012;
    const ox = (nx / nl) * off;
    const oy = (ny / nl) * off;
    const taper = Math.max(0.12, 1 - Math.abs(s - strokes / 2) / (strokes * 0.72));
    const alpha = (dark ? 0.075 : 0.06) * alphaScale * taper;
    ctx.strokeStyle = dark
      ? toneToRgba(tone, alpha)
      : `rgba(70,84,110,${alpha})`;
    ctx.lineWidth = 1.1 * k;
    ctx.beginPath();
    ctx.moveTo(p0[0] + ox, p0[1] + oy);
    ctx.quadraticCurveTo(p1[0] + ox + fan * width * 0.2, p1[1] + oy - fan * height * 0.2, p2[0] + ox, p2[1] + oy);
    ctx.stroke();
  }
  // spine highlight: one brighter pass along the fold center so the silk glows
  ctx.strokeStyle = dark ? toneToRgba(tone, 0.26 * alphaScale) : `rgba(70,84,110,${0.14 * alphaScale})`;
  ctx.lineWidth = 0.9 * k;
  ctx.beginPath();
  ctx.moveTo(p0[0], p0[1]);
  ctx.quadraticCurveTo(p1[0], p1[1], p2[0], p2[1]);
  ctx.stroke();
  return p2;
}

function starCaustic(ctx, x, y, size, rnd, salt, dark) {
  const bloom = ctx.createRadialGradient(x, y, 0, x, y, size * 2.4);
  bloom.addColorStop(0, dark ? "rgba(255,255,255,0.5)" : "rgba(60,72,96,0.16)");
  bloom.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = bloom;
  ctx.fillRect(x - size * 2.4, y - size * 2.4, size * 4.8, size * 4.8);
  const rot = rnd(salt) * Math.PI;
  ctx.fillStyle = dark ? "rgba(255,255,255,0.55)" : "rgba(60,72,96,0.28)";
  for (let k = 0; k < 2; k += 1) {
    const a = rot + (k * Math.PI) / 2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * size * 2.6, y + Math.sin(a) * size * 2.6);
    ctx.lineTo(x + Math.cos(a + Math.PI / 2) * size * 0.14, y + Math.sin(a + Math.PI / 2) * size * 0.14);
    ctx.lineTo(x + Math.cos(a + Math.PI) * size * 2.6, y + Math.sin(a + Math.PI) * size * 2.6);
    ctx.lineTo(x + Math.cos(a - Math.PI / 2) * size * 0.14, y + Math.sin(a - Math.PI / 2) * size * 0.14);
    ctx.closePath();
    ctx.fill();
  }
}

function drawCausticVeils(ctx, width, height, tick, seed, palette) {
  const rnd = (salt) => rand(seed, salt);
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(3,4,9,0.94)";
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = "lighter";
  const ribbons = 9 + Math.floor(rnd(300) * 7);
  const crossings = [];
  for (let r = 0; r < ribbons; r += 1) {
    const tone = VEIL_TONES[Math.floor(rnd(310 + r * 11) * VEIL_TONES.length)];
    crossings.push(veilRibbon(ctx, width, height, rnd, 320 + r * 13, tone, 1, true));
  }
  const stars = 2 + Math.floor(rnd(301) * 3);
  for (let k = 0; k < stars; k += 1) {
    const p = crossings[Math.floor(rnd(430 + k * 7) * crossings.length)];
    starCaustic(ctx, p[0], p[1], 7 + rnd(440 + k * 5) * 12, rnd, 450 + k * 3, true);
  }
  ctx.restore();
}

function drawCausticPaper(ctx, width, height, tick, seed, palette) {
  const rnd = (salt) => rand(seed, salt);
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgb(243,244,246)";
  ctx.fillRect(0, 0, width, height);
  const ribbons = 7 + Math.floor(rnd(500) * 5);
  const crossings = [];
  for (let r = 0; r < ribbons; r += 1) {
    crossings.push(veilRibbon(ctx, width, height, rnd, 510 + r * 17, VEIL_TONES[0], 1, false));
  }
  const stars = 1 + Math.floor(rnd(501) * 2);
  for (let k = 0; k < stars; k += 1) {
    const p = crossings[Math.floor(rnd(620 + k * 7) * crossings.length)];
    starCaustic(ctx, p[0], p[1], 6 + rnd(630 + k * 5) * 9, rnd, 640 + k * 3, false);
  }
  ctx.restore();
}

function drawPlanetLimb(ctx, width, height, tick, seed, palette) {
  const rnd = (salt) => rand(seed, salt);
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(1,2,7,0.96)";
  ctx.fillRect(0, 0, width, height);
  const R = Math.max(width, height) * (1.05 + rnd(700) * 0.5);
  const cx = width * (0.35 + rnd(701) * 0.3);
  const cy = height + R * (0.62 + rnd(702) * 0.2);
  ctx.globalCompositeOperation = "lighter";
  const arcs = 26;
  for (let i = 0; i < arcs; i += 1) {
    const t = i / (arcs - 1);
    const rr = R + (t - 0.5) * 26;
    const col = t < 0.4
      ? `rgba(50,90,220,${0.05 + t * 0.2})`
      : t < 0.75
        ? `rgba(90,200,240,${0.12 + (t - 0.4) * 0.5})`
        : `rgba(240,250,255,${0.28 + (t - 0.75) * 1.6})`;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.2 + (1 - Math.abs(t - 0.8)) * 3;
    ctx.beginPath();
    ctx.arc(cx, cy, rr, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
  }
  // ice cloud deck hugging the limb
  for (let i = 0; i < 70; i += 1) {
    const a = Math.PI * (1.12 + rnd(720 + i * 3) * 0.76);
    const rr = R - 8 - rnd(721 + i * 3) * 44;
    const ex = cx + Math.cos(a) * rr;
    const ey = cy + Math.sin(a) * rr;
    if (ey < -20 || ey > height + 20 || ex < -40 || ex > width + 40) continue;
    ctx.fillStyle = `rgba(235,245,255,${0.03 + rnd(722 + i * 3) * 0.06})`;
    ctx.beginPath();
    ctx.ellipse(ex, ey, 14 + rnd(723 + i * 3) * 40, 3 + rnd(724 + i * 3) * 7, a + Math.PI / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  // spires
  const spires = 3 + Math.floor(rnd(760) * 3);
  for (let s = 0; s < spires; s += 1) {
    const a = Math.PI * (1.25 + rnd(770 + s * 5) * 0.5);
    const bx = cx + Math.cos(a) * (R - 2);
    const by = cy + Math.sin(a) * (R - 2);
    const hgt = 30 + rnd(771 + s * 5) * height * 0.24;
    ctx.fillStyle = "rgba(245,250,255,0.5)";
    ctx.beginPath();
    ctx.moveTo(bx - 2.4, by);
    ctx.lineTo(bx, by - hgt);
    ctx.lineTo(bx + 2.4, by);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawAuroraLeak(ctx, width, height, tick, seed, palette) {
  const rnd = (salt) => rand(seed, salt);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const curtains = 5 + Math.floor(rnd(800) * 4);
  const tones = [[80, 235, 190], [120, 160, 255], [200, 120, 255], [90, 220, 250]];
  for (let c = 0; c < curtains; c += 1) {
    const baseX = width * rnd(810 + c * 9);
    const tone = tones[Math.floor(rnd(811 + c * 9) * tones.length)];
    const drop = height * (0.35 + rnd(812 + c * 9) * 0.55);
    const sway = 20 + rnd(813 + c * 9) * 60;
    const rays = 30 + Math.floor(rnd(814 + c * 9) * 40);
    for (let i = 0; i < rays; i += 1) {
      const t = i / rays;
      const x = baseX + Math.sin(t * 5 + c) * sway + (t - 0.5) * 60;
      const len = drop * (0.5 + rnd(820 + c * 31 + i) * 0.5);
      const grad = ctx.createLinearGradient(x, 0, x, len);
      grad.addColorStop(0, toneToRgba(tone, 0.16));
      grad.addColorStop(1, toneToRgba(tone, 0));
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x, -4);
      ctx.lineTo(x + Math.sin(t * 9) * 6, len);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawObsidianBurst(ctx, width, height, tick, seed, palette) {
  const rnd = (salt) => rand(seed, salt);
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(4,3,8,0.9)";
  ctx.fillRect(0, 0, width, height);
  const cx = width * (0.3 + rnd(900) * 0.4);
  const cy = height * (0.3 + rnd(901) * 0.4);
  const shards = 26 + Math.floor(rnd(902) * 14);
  for (let s = 0; s < shards; s += 1) {
    const a = rnd(910 + s * 7) * Math.PI * 2;
    const len = Math.max(width, height) * (0.2 + rnd(911 + s * 7) * 0.55);
    const wdt = 4 + rnd(912 + s * 7) * 26;
    const x1 = cx + Math.cos(a) * len;
    const y1 = cy + Math.sin(a) * len;
    const px = Math.cos(a + Math.PI / 2) * wdt;
    const py = Math.sin(a + Math.PI / 2) * wdt;
    ctx.fillStyle = `rgba(${10 + Math.floor(rnd(913 + s * 7) * 14)},${8 + Math.floor(rnd(914 + s * 7) * 10)},${16 + Math.floor(rnd(915 + s * 7) * 18)},0.85)`;
    ctx.beginPath();
    ctx.moveTo(cx + px * 0.2, cy + py * 0.2);
    ctx.lineTo(x1 + px, y1 + py);
    ctx.lineTo(x1 - px, y1 - py);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `rgba(190,225,255,${0.08 + rnd(916 + s * 7) * 0.22})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "lighter";
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, 60 + rnd(903) * 60);
  core.addColorStop(0, "rgba(255,236,200,0.6)");
  core.addColorStop(0.4, "rgba(255,170,90,0.22)");
  core.addColorStop(1, "rgba(255,170,90,0)");
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, width, height);
  for (let d = 0; d < 30; d += 1) {
    const a = rnd(950 + d * 3) * Math.PI * 2;
    const rr = 20 + rnd(951 + d * 3) * Math.max(width, height) * 0.4;
    ctx.fillStyle = `rgba(255,230,180,${0.1 + rnd(952 + d * 3) * 0.3})`;
    ctx.fillRect(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 1.6, 1.6);
  }
  ctx.restore();
}

function drawDendrite(ctx, width, height, tick, seed, palette) {
  const rnd = (salt) => rand(seed, salt);
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  let salt = 1000;
  const queue = [];
  const roots = 1 + Math.floor(rnd(999) * 2);
  for (let r = 0; r < roots; r += 1) {
    queue.push({
      x: width * (0.2 + rnd(salt += 1) * 0.6),
      y: height * 1.02,
      a: -Math.PI / 2 + (rnd(salt += 1) - 0.5) * 0.4,
      len: height * (0.14 + rnd(salt += 1) * 0.08),
      depth: 0,
    });
  }
  while (queue.length) {
    const b = queue.pop();
    if (b.depth > 8 || b.len < 3) continue;
    const wob = (rnd(salt += 1) - 0.5) * 0.5;
    const x1 = b.x + Math.cos(b.a + wob) * b.len;
    const y1 = b.y + Math.sin(b.a + wob) * b.len;
    ctx.strokeStyle = `rgba(210,226,240,${0.55 - b.depth * 0.05})`;
    ctx.lineWidth = Math.max(0.6, 2.6 - b.depth * 0.32);
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    if (b.depth > 1 && rnd(salt += 1) > 0.62) {
      ctx.strokeStyle = "rgba(180,205,230,0.12)";
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + (rnd(salt += 1) > 0.5 ? width : -width) * 0.5, y1);
      ctx.stroke();
    }
    const kids = b.depth < 2 ? 2 : rnd(salt += 1) > 0.3 ? 2 : 1;
    for (let k = 0; k < kids; k += 1) {
      queue.push({
        x: x1, y: y1,
        a: b.a + (k === 0 ? -1 : 1) * (0.28 + rnd(salt += 1) * 0.45),
        len: b.len * (0.68 + rnd(salt += 1) * 0.12),
        depth: b.depth + 1,
      });
    }
  }
  ctx.restore();
}

function drawRisoMoire(ctx, width, height, tick, seed, palette) {
  const rnd = (salt) => rand(seed, salt);
  const inks = [[235, 71, 143], [80, 196, 185], [239, 171, 48], [135, 237, 74]];
  const inkA = inks[Math.floor(rnd(1100) * inks.length)];
  let inkB = inks[Math.floor(rnd(1101) * inks.length)];
  if (inkB === inkA) inkB = inks[(inks.indexOf(inkA) + 1) % inks.length];
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.beginPath();
  ctx.arc(width * (0.3 + rnd(1102) * 0.4), height * (0.3 + rnd(1103) * 0.4),
    Math.min(width, height) * (0.42 + rnd(1104) * 0.22), 0, Math.PI * 2);
  ctx.clip();
  // pass A: line raster, slightly rotated
  ctx.translate(width / 2, height / 2);
  ctx.rotate((rnd(1105) - 0.5) * 0.12);
  ctx.translate(-width / 2, -height / 2);
  ctx.strokeStyle = toneToRgba(inkA, 0.22);
  ctx.lineWidth = 1.6;
  for (let y = -20; y < height + 20; y += 5) {
    ctx.beginPath();
    ctx.moveTo(-20, y);
    ctx.lineTo(width + 20, y);
    ctx.stroke();
  }
  // pass B: dot grid, rotated the other way (misregistered overprint)
  ctx.translate(width / 2, height / 2);
  ctx.rotate(0.06 + rnd(1106) * 0.1);
  ctx.translate(-width / 2, -height / 2);
  ctx.fillStyle = toneToRgba(inkB, 0.3);
  for (let y = -20; y < height + 20; y += 7) {
    for (let x = -20; x < width + 20; x += 7) {
      if (orderedDither(x / 7, y / 7) > 0.4) ctx.fillRect(x, y, 2.1, 2.1);
    }
  }
  ctx.restore();
}

function drawMoireSwirl(ctx, width, height, tick, seed, palette) {
  const rnd = (salt) => rand(seed, salt);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const c1x = width * (0.42 + rnd(1200) * 0.16);
  const c1y = height * (0.42 + rnd(1201) * 0.16);
  const off = 24 + rnd(1202) * 60;
  const ang = rnd(1203) * Math.PI * 2;
  const c2x = c1x + Math.cos(ang) * off;
  const c2y = c1y + Math.sin(ang) * off;
  const maxR = Math.max(width, height) * 0.75;
  const toneA = [190, 230, 255];
  const toneB = [255, 170, 220];
  for (let r = 6; r < maxR; r += 6) {
    ctx.strokeStyle = toneToRgba(toneA, 0.055);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(c1x, c1y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = toneToRgba(toneB, 0.05);
    ctx.beginPath();
    ctx.arc(c2x, c2y, r + rnd(1210) * 1.5, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPlotterPlate(ctx, width, height, tick, seed, palette) {
  const rnd = (salt) => rand(seed, salt);
  const ink = "rgba(226,232,224,0.5)";
  const hatch = (cx, cy, r, angle, gap, salt) => {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 0.8;
    for (let y = -r; y <= r; y += gap) {
      ctx.beginPath();
      ctx.moveTo(-r, y);
      ctx.lineTo(r, y);
      ctx.stroke();
    }
    ctx.restore();
  };
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  // margin frame, plotter style
  ctx.strokeStyle = "rgba(226,232,224,0.28)";
  ctx.lineWidth = 1;
  ctx.strokeRect(width * 0.05, height * 0.08, width * 0.9, height * 0.84);
  const shapes = 4 + Math.floor(rnd(1300) * 3);
  for (let s = 0; s < shapes; s += 1) {
    hatch(
      width * (0.18 + rnd(1310 + s * 7) * 0.64),
      height * (0.2 + rnd(1311 + s * 7) * 0.6),
      Math.min(width, height) * (0.08 + rnd(1312 + s * 7) * 0.16),
      rnd(1313 + s * 7) * Math.PI,
      2.4 + rnd(1314 + s * 7) * 3.2,
      1320 + s * 7
    );
  }
  // one sine band across the plate
  ctx.strokeStyle = ink;
  ctx.lineWidth = 0.8;
  const bandY = height * (0.3 + rnd(1301) * 0.4);
  for (let k = 0; k < 7; k += 1) {
    ctx.beginPath();
    for (let x = width * 0.05; x <= width * 0.95; x += 4) {
      const y = bandY + k * 3.2 + Math.sin(x * 0.02 + rnd(1302) * 9 + k * 0.22) * height * 0.05;
      if (x === width * 0.05) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawAcidDuotone(ctx, width, height, tick, seed, palette) {
  const rnd = (salt) => rand(seed, salt);
  const lime = [148, 250, 60];
  const magenta = [244, 60, 180];
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  // diagonal band super-shapes
  const bands = 3 + Math.floor(rnd(1400) * 3);
  for (let b = 0; b < bands; b += 1) {
    const tone = b % 2 === 0 ? lime : magenta;
    const y0 = height * rnd(1410 + b * 7);
    const th = height * (0.08 + rnd(1411 + b * 7) * 0.18);
    const slope = (rnd(1412 + b * 7) - 0.5) * height * 0.8;
    ctx.fillStyle = toneToRgba(tone, 0.55);
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.lineTo(width, y0 + slope);
    ctx.lineTo(width, y0 + slope + th);
    ctx.lineTo(0, y0 + th);
    ctx.closePath();
    ctx.fill();
  }
  // halftone patch
  const px = width * (0.1 + rnd(1401) * 0.5);
  const py = height * (0.1 + rnd(1402) * 0.5);
  const pw = width * 0.3;
  const ph = height * 0.3;
  ctx.fillStyle = toneToRgba(magenta, 0.6);
  for (let y = 0; y < ph; y += 6) {
    for (let x = 0; x < pw; x += 6) {
      const rDot = 2.6 * (1 - y / ph) * (0.4 + orderedDither(x / 6, y / 6));
      if (rDot > 0.5) {
        ctx.beginPath();
        ctx.arc(px + x, py + y, rDot, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // one big cut circle slice
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = toneToRgba(lime, 0.7);
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(width * (0.4 + rnd(1403) * 0.3), height * (0.4 + rnd(1404) * 0.3),
    Math.min(width, height) * 0.34, rnd(1405) * Math.PI, rnd(1405) * Math.PI + Math.PI * 1.2);
  ctx.stroke();
  ctx.restore();
}

/* The house destruction finisher: coarse-grid self-displacement, pixel-sort
   smears, dither noise patches, channel fringe, and 1-3 flat hot rects.
   seed=null means true-random (a live one-off is sanctioned). */
export function applyDatabend(ctx, width, height, seed = null, intensity = 0.5) {
  const seedNum = seed == null ? null : hashRoute(String(seed));
  const R = (salt) => (seedNum == null ? Math.random() : rand(seedNum, salt));
  const source = ctx.canvas;
  if (!source) return false;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  // 1) grid displacement
  const rows = 10;
  const cells = Math.floor(10 + intensity * 26);
  for (let i = 0; i < cells; i += 1) {
    const rh = Math.max(4, Math.floor(height / rows));
    const sy = Math.floor(R(10 + i * 5) * (height - rh));
    const sw = Math.floor(width * (0.12 + R(11 + i * 5) * 0.4));
    const sx = Math.floor(R(12 + i * 5) * (width - sw));
    const dx = Math.floor((R(13 + i * 5) - 0.5) * width * 0.22 * intensity * 2);
    try { ctx.drawImage(source, sx, sy, sw, rh, sx + dx, sy, sw, rh); } catch (e) { break; }
  }
  // 2) pixel-sort smears: stretch a thin slice wide
  const smears = Math.floor(5 + intensity * 9);
  for (let i = 0; i < smears; i += 1) {
    const sy = Math.floor(R(60 + i * 4) * (height - 3));
    const sx = Math.floor(R(61 + i * 4) * (width - 4));
    const sh = 2 + Math.floor(R(62 + i * 4) * 8);
    const len = Math.floor(width * (0.1 + R(63 + i * 4) * 0.5));
    try { ctx.drawImage(source, sx, sy, 2, sh, sx, sy, len, sh); } catch (e) { break; }
  }
  // 3) dither noise patches
  const patches = 2 + Math.floor(R(100) * 2);
  for (let p = 0; p < patches; p += 1) {
    const pw2 = 20 + R(110 + p * 3) * width * 0.12;
    const ph2 = 12 + R(111 + p * 3) * height * 0.1;
    const px2 = R(112 + p * 3) * (width - pw2);
    const py2 = R(113 + p * 3) * (height - ph2);
    for (let y = 0; y < ph2; y += 3) {
      for (let x = 0; x < pw2; x += 3) {
        if (orderedDither(x / 3, y / 3) > 0.55) {
          ctx.fillStyle = R(120 + p) > 0.5 ? "rgba(240,244,250,0.5)" : "rgba(8,10,16,0.6)";
          ctx.fillRect(px2 + x, py2 + y, 2, 2);
        }
      }
    }
  }
  // 4) channel fringe: shifted low-alpha self-copies
  ctx.globalAlpha = 0.22;
  try {
    ctx.drawImage(source, 3, 0);
    ctx.drawImage(source, -3, 1);
  } catch (e) { /* stub contexts without full drawImage support */ }
  ctx.globalAlpha = 1;
  // 5) flat hot rects
  const hots = 1 + Math.floor(R(200) * 2);
  for (let hIdx = 0; hIdx < hots; hIdx += 1) {
    ctx.fillStyle = R(210 + hIdx) > 0.5 ? "rgba(244,60,120,0.85)" : "rgba(255,120,40,0.85)";
    ctx.fillRect(R(211 + hIdx * 3) * width * 0.9, R(212 + hIdx * 3) * height * 0.9,
      4 + R(213 + hIdx * 3) * width * 0.06, 3 + R(214 + hIdx * 3) * 10);
  }
  ctx.restore();
  return true;
}

function drawDatabendLayer(ctx, width, height, tick, seed) {
  applyDatabend(ctx, width, height, seed, 0.55);
}

/* ---------------------------------------------------------------------------
   WAVE 3 (2026-07-10): the deep corpus. Object-on-velvet lanterns, hairline
   particle curtains, pixel-sort ruins, chaos-game light columns, DLA coral,
   woven cloth, and fiber canyons. Same one-shot contract as wave 2.
--------------------------------------------------------------------------- */

function drawStellatedLantern(ctx, width, height, tick, seed, palette) {
  const rnd = (salt) => rand(seed, salt);
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(0,0,0,0.96)";
  ctx.fillRect(0, 0, width, height);
  const cx = width * (0.44 + rnd(2000) * 0.12);
  const cy = height * (0.46 + rnd(2001) * 0.1);
  const R = Math.min(width, height) * (0.24 + rnd(2002) * 0.1);
  const N = 4 + Math.floor(rnd(2003) * 5);
  const petals = 8 + Math.floor(rnd(2004) * 10);
  ctx.strokeStyle = "rgba(236,230,214,0.5)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, -4);
  ctx.lineTo(cx, cy - R * 1.02);
  ctx.stroke();
  ctx.globalCompositeOperation = "lighter";
  for (let k = 0; k < N * 2; k += 1) {
    const base = (k * Math.PI) / N;
    const mirror = k % 2 === 1;
    for (let p = 0; p < petals; p += 1) {
      const t = 1 - p / petals;
      const rr = R * (0.22 + t * 0.78);
      const wdt = (Math.PI / N) * 0.82 * t + 0.06;
      const saw = 1 + (p % 2) * 0.06;
      const a0 = base + (mirror ? wdt : -wdt);
      ctx.fillStyle = `rgba(244,227,189,${0.12 + t * 0.16})`;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      const steps = 7;
      for (let s2 = 0; s2 <= steps; s2 += 1) {
        const f = s2 / steps;
        const ang = base + (a0 - base) * Math.sin(f * Math.PI);
        const jag = 1 + (s2 % 2) * 0.045 * saw;
        ctx.lineTo(cx + Math.cos(ang) * rr * f * jag, cy + Math.sin(ang) * rr * f * jag);
      }
      ctx.closePath();
      ctx.fill();
      if (p % 2 === 0) {
        ctx.strokeStyle = `rgba(255,238,204,${0.10 + t * 0.14})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.15);
  core.addColorStop(0, "rgba(255,244,214,0.9)");
  core.addColorStop(0.3, "rgba(226,178,110,0.42)");
  core.addColorStop(1, "rgba(150,120,80,0)");
  ctx.fillStyle = core;
  ctx.fillRect(cx - R * 1.2, cy - R * 1.2, R * 2.4, R * 2.4);
  ctx.restore();
}

function drawFiberStrands(ctx, width, height, tick, seed, palette) {
  const rnd = (salt) => rand(seed, salt);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const hotX = width * (0.3 + rnd(2100) * 0.4);
  const hotY = height * (0.3 + rnd(2101) * 0.4);
  const maxD = Math.hypot(width, height) * 0.6;
  const particles = 900 + Math.floor(rnd(2102) * 900);
  let salt = 2110;
  for (let p2 = 0; p2 < particles; p2 += 1) {
    let x = rnd(salt += 1) * width;
    let y = rnd(salt += 1) * height * 0.5;
    const steps = 16 + Math.floor(rnd(salt += 1) * 30);
    const d = Math.hypot(x - hotX, y - hotY) / maxD;
    const tone = d < 0.33 ? [72, 216, 200] : d < 0.66 ? [232, 168, 60] : [122, 95, 208];
    ctx.strokeStyle = toneToRgba(tone, 0.07);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s2 = 0; s2 < steps; s2 += 1) {
      const a = fieldAngle(x, y, tick, seed) * 0.55 + (Math.PI / 2) * 0.7;
      x += Math.cos(a) * 4;
      y += Math.abs(Math.sin(a)) * 4 + 2.1;
      ctx.lineTo(x, y);
      if (y > height + 8) break;
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawPixelSortRuin(ctx, width, height, tick, seed, palette) {
  const rnd = (salt) => rand(seed, salt);
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(10,10,12,0.95)";
  ctx.fillRect(0, 0, width, height);
  const keys = [
    [[225, 75, 210], [240, 160, 200]],
    [[255, 180, 60], [90, 107, 128]],
    [[223, 232, 238], [201, 184, 236]],
  ];
  const key = keys[Math.floor(rnd(2200) * keys.length)];
  const mirror = rnd(2201) > 0.45;
  const half = mirror ? width / 2 : width;
  let salt = 2210;
  const runs = 320 + Math.floor(rnd(2202) * 260);
  for (let i = 0; i < runs; i += 1) {
    const x = rnd(salt += 1) * half;
    const y = rnd(salt += 1) * height;
    const w2 = 2 + rnd(salt += 1) * 7;
    const len = 18 + rnd(salt += 1) * 170 * (0.4 + Math.abs(Math.sin(y * 0.01 + seed)));
    const tone = key[rnd(salt += 1) > 0.5 ? 0 : 1];
    ctx.fillStyle = toneToRgba(tone, 0.16 + rnd(salt += 1) * 0.5);
    if (rnd(salt += 1) > 0.5) ctx.fillRect(x, y, w2, len);
    else ctx.fillRect(x, y, len, w2);
    if (mirror) {
      ctx.fillStyle = toneToRgba(tone, 0.14 + rnd(salt) * 0.4);
      if (rnd(salt) > 0.5) ctx.fillRect(width - x - w2, y, w2, len);
      else ctx.fillRect(width - x - len, y, len, w2);
    }
  }
  if (mirror) {
    const coreGrad = ctx.createLinearGradient(width / 2 - 30, 0, width / 2 + 30, 0);
    coreGrad.addColorStop(0, "rgba(223,232,238,0)");
    coreGrad.addColorStop(0.5, "rgba(223,232,238,0.28)");
    coreGrad.addColorStop(1, "rgba(223,232,238,0)");
    ctx.fillStyle = coreGrad;
    ctx.fillRect(width / 2 - 30, 0, 60, height);
  }
  ctx.restore();
}

function drawIfsLightVeil(ctx, width, height, tick, seed, palette) {
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(1,1,3,0.97)";
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = "lighter";
  const rnd = (salt) => rand(seed, salt);
  const colX = width * (0.36 + rnd(2300) * 0.28);
  const colW = width * (0.05 + rnd(2301) * 0.07);
  const maps = [];
  for (let m = 0; m < 3; m += 1) {
    maps.push({
      sx: 0.42 + rnd(2310 + m * 5) * 0.34,
      sy: 0.62 + rnd(2311 + m * 5) * 0.3,
      tx: (rnd(2312 + m * 5) - 0.5) * colW * 2,
      ty: rnd(2313 + m * 5) * height * 0.4,
      rot: (rnd(2314 + m * 5) - 0.5) * 0.5,
    });
  }
  const fringes = [["255,214,166", -1.6, 0], ["166,200,255", 1.6, 0.7], ["208,255,182", 0, -1.4]];
  let px = 0;
  let py = 0;
  const iterations = 42000;
  for (let i = 0; i < iterations; i += 1) {
    const m = maps[Math.floor(rand(seed, 2400 + (i % 997)) * maps.length)];
    const nx = px * Math.cos(m.rot) * m.sx - py * Math.sin(m.rot) * m.sx + m.tx;
    const ny = px * Math.sin(m.rot) * m.sy + py * Math.cos(m.rot) * m.sy + m.ty;
    px = nx;
    py = ny;
    if (i < 24) continue;
    const fr = fringes[i % 3];
    ctx.fillStyle = `rgba(${fr[0]},0.07)`;
    ctx.fillRect(colX + px + fr[1], ((py % height) + height) % height + fr[2], 2, 2);
  }
  ctx.restore();
}

function drawDlaCoral(ctx, width, height, tick, seed, palette) {
  const rnd = (salt) => rand(seed, salt);
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(6,9,22,0.95)";
  ctx.fillRect(0, 0, width, height);
  // Scale-aware: the growth grid follows the canvas so the coral occupies the
  // same fraction of a 300px tile and a 2200px plate (a fixed 3px cell made it
  // vanish at plate scale - operator-reported low visibility, 2026-07-10).
  const cell = Math.max(3, Math.round(Math.min(width, height) / 150));
  const gw = Math.ceil(width / cell);
  const gh = Math.ceil(height / cell);
  const grid = new Uint8Array(gw * gh);
  const cxg = Math.floor(gw * (0.35 + rnd(2500) * 0.3));
  const cyg = Math.floor(gh * (0.36 + rnd(2501) * 0.2));
  grid[cyg * gw + cxg] = 1;
  const walkers = 3400;
  let stuckCount = 1;
  let salt = 2510;
  let maxR = 2;
  const ring = Math.min(gw, gh) * 0.42;
  for (let w2 = 0; w2 < walkers; w2 += 1) {
    // Spawn near the living edge (maxR-tracked): far more walkers stick, so
    // the accretion reads as a full reef instead of a sparse dust.
    const a0 = rnd(salt += 1) * Math.PI * 2;
    const spawnR = Math.min(ring, maxR + 4 + rnd(salt += 1) * 10);
    let gx = Math.floor(cxg + Math.cos(a0) * spawnR);
    let gy = Math.floor(cyg + Math.sin(a0) * spawnR);
    for (let s2 = 0; s2 < 380; s2 += 1) {
      const dir = Math.floor(rand(seed, salt + s2) * 4);
      gx += dir === 0 ? 1 : dir === 1 ? -1 : 0;
      gy += dir === 2 ? 1 : dir === 3 ? -1 : 0;
      if (gx < 1 || gy < 1 || gx >= gw - 1 || gy >= gh - 1) break;
      if (grid[gy * gw + gx + 1] || grid[gy * gw + gx - 1] || grid[(gy + 1) * gw + gx] || grid[(gy - 1) * gw + gx]) {
        stuckCount += 1;
        grid[gy * gw + gx] = 1;
        const dist = Math.hypot(gx - cxg, gy - cyg);
        maxR = Math.max(maxR, dist);
        // Colour by radius, not stick order: a bright yellow core grading
        // through cyan to deep blue at the rim - robust at every stick rate.
        const rNorm = Math.min(1, dist / (ring * 0.5));
        const tone = rNorm < 0.3 ? [250, 236, 92] : rNorm < 0.62 ? [86, 216, 244] : [52, 118, 204];
        ctx.fillStyle = toneToRgba(tone, 0.95);
        ctx.fillRect(gx * cell, gy * cell, cell + 1, cell + 1);
        if (rand(seed, salt + s2 + 7) > 0.96) {
          ctx.strokeStyle = "rgba(224,52,32,0.55)";
          ctx.lineWidth = Math.max(1, cell * 0.35);
          ctx.beginPath();
          ctx.moveTo(gx * cell, gy * cell + cell);
          ctx.lineTo(gx * cell + (rand(seed, salt + s2 + 9) - 0.5) * cell * 3, gy * cell + cell * 7 + rand(seed, salt + s2 + 11) * cell * 20);
          ctx.stroke();
        }
        break;
      }
    }
    salt += 240;
  }
  // A soft additive halo over the grown reef lifts it out of the deep ground.
  ctx.globalCompositeOperation = "lighter";
  const glowR = Math.max(cell * 8, (maxR + 6) * cell);
  const glow = ctx.createRadialGradient(cxg * cell, cyg * cell, 0, cxg * cell, cyg * cell, glowR);
  glow.addColorStop(0, "rgba(140,220,255,0.22)");
  glow.addColorStop(0.55, "rgba(80,150,230,0.10)");
  glow.addColorStop(1, "rgba(80,150,230,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(cxg * cell - glowR, cyg * cell - glowR, glowR * 2, glowR * 2);
  ctx.restore();
}

function drawWeaveLattice(ctx, width, height, tick, seed, palette) {
  const rnd = (salt) => rand(seed, salt);
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, "rgb(208,138,40)");
  grad.addColorStop(0.5, "rgb(168,160,64)");
  grad.addColorStop(1, "rgb(154,184,120)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  const cellW = 30 + rnd(2600) * 12;
  let salt = 2610;
  ctx.lineCap = "round";
  for (let y = -cellW; y < height + cellW; y += cellW) {
    for (let x = -cellW; x < width + cellW; x += cellW) {
      if (rnd(salt += 1) < 0.15) continue;
      const horiz = ((Math.floor(x / cellW) + Math.floor(y / cellW)) % 2 === 0) !== (rnd(salt += 1) > 0.8);
      const jx = x + (rnd(salt += 1) - 0.5) * 8;
      const jy = y + (rnd(salt += 1) - 0.5) * 8;
      const len = cellW * (0.78 + rnd(salt += 1) * 0.3);
      const wander = rnd(salt += 1) > 0.8 ? (rnd(salt += 1) - 0.5) * cellW * 0.5 : 0;
      const x2 = horiz ? jx + len : jx + wander;
      const y2 = horiz ? jy + wander : jy + len;
      ctx.strokeStyle = "rgba(21,18,8,0.85)";
      ctx.lineWidth = cellW * 0.34;
      ctx.beginPath();
      ctx.moveTo(jx, jy);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.strokeStyle = grad;
      ctx.lineWidth = cellW * 0.1;
      ctx.beginPath();
      ctx.moveTo(jx, jy);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      if (rnd(salt += 1) > 0.78) {
        ctx.fillStyle = "rgba(21,18,8,0.8)";
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 + 4 + rnd(salt += 1) * 5, y2 + 2);
        ctx.lineTo(x2 + 2, y2 + 5 + rnd(salt += 1) * 4);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

function drawFiberTerrain(ctx, width, height, tick, seed, palette) {
  const rnd = (salt) => rand(seed, salt);
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(14,6,20,0.96)";
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = "lighter";
  let salt = 2700;
  const strokes = 2400 + Math.floor(rnd(2701) * 1200);
  for (let i = 0; i < strokes; i += 1) {
    const y = height * (0.3 + rnd(salt += 1) * 0.68);
    const x = rnd(salt += 1) * width;
    const band = (y / height - 0.3) / 0.7;
    const tone = band < 0.35 ? [214, 90, 160] : band < 0.7 ? [222, 178, 92] : [70, 190, 170];
    const a = fieldAngle(x, y, tick, seed) * 0.22;
    const len = 6 + rnd(salt += 1) * 16;
    ctx.strokeStyle = toneToRgba(tone, 0.1 + rnd(salt += 1) * 0.12);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len * 0.4);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "destination-out";
  const voids = 1 + Math.floor(rnd(2702) * 2);
  for (let v = 0; v < voids; v += 1) {
    ctx.beginPath();
    ctx.ellipse(width * (0.25 + rnd(2710 + v * 3) * 0.5), height * (0.55 + rnd(2711 + v * 3) * 0.3),
      width * (0.05 + rnd(2712 + v * 3) * 0.08), height * (0.12 + rnd(2713 + v * 3) * 0.16), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = "rgba(240,244,250,0.2)";
  ctx.lineWidth = 0.8;
  for (let row = 0; row < 5; row += 1) {
    const baseY = height * (0.18 + row * 0.05);
    ctx.beginPath();
    for (let x = 0; x <= width; x += 14) {
      const y = baseY + Math.sin(x * 0.012 + row + (seed % 10)) * 14 + Math.sin(x * 0.037 + (seed % 7)) * 5;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/* Named showpieces: composed stacks tuned so the families stay coherent. */
function drawShowpieceVeil(ctx, width, height, tick, seed, palette) {
  drawCausticVeils(ctx, width, height, tick, seed, palette);
  applyDatabend(ctx, width, height, seed, 0.22);
}

function drawShowpieceBurst(ctx, width, height, tick, seed, palette) {
  drawObsidianBurst(ctx, width, height, tick, seed, palette);
  drawAuroraLeak(ctx, width, height, tick, seed + 7, palette);
}

function drawShowpieceWeave(ctx, width, height, tick, seed, palette) {
  drawRisoMoire(ctx, width, height, tick, seed, palette);
  drawDendrite(ctx, width, height, tick, seed + 11, palette);
}

function drawShowpieceLantern(ctx, width, height, tick, seed, palette) {
  drawStellatedLantern(ctx, width, height, tick, seed, palette);
  drawIfsLightVeil(ctx, width, height, tick, seed + 13, palette);
}

function drawShowpieceRuin(ctx, width, height, tick, seed, palette) {
  drawPixelSortRuin(ctx, width, height, tick, seed, palette);
  drawAuroraLeak(ctx, width, height, tick, seed + 17, palette);
}

/* ---------------------------------------------------------------------------
   Specimen strips: one-shot, deterministic renders of the same layer library
   into small page-owned canvases (canvas[data-specimen]). No animation loop,
   no listeners; reduced motion needs no special case because the frame is
   already static. Seeded by a string so a page's specimen is reproducible.
--------------------------------------------------------------------------- */
/* ---------------------------------------------------------------------------
   Neural instruments (2026-07-10). Seed-authored networks rendered to canvas.
   drawNeuralField paints a CPPN colour field; drawNeuralSdf sphere-marches a
   neural signed-distance surface. Both are one-shot and deterministic per
   seed; the network weights come entirely from the seed (no shipped model).
--------------------------------------------------------------------------- */

// The CPPN colour field: evaluate the network over a coarse grid and fill
// cells. Raw CPPN output is a full-gamut RGB; we tug it toward the route
// palette's jewel tones so it sits inside the site's register instead of
// reading as a rainbow. Cell size scales with the canvas so the structure
// holds from a specimen strip to a full-bleed plate.
function drawNeuralField(ctx, width, height, tick, seed, palette) {
  const net = buildCppn(seed);
  const tint = (palette && palette.fluid) || [[80, 196, 185], [167, 115, 255], [239, 171, 48]];
  const cell = Math.max(2, Math.round(Math.min(width, height) / 240));
  const cols = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(6,7,14,1)";
  ctx.fillRect(0, 0, width, height);
  for (let gy = 0; gy < rows; gy += 1) {
    const ny = (gy / (rows - 1)) * 2 - 1;
    for (let gx = 0; gx < cols; gx += 1) {
      const nx = (gx / (cols - 1)) * 2 - 1;
      const c = net.eval(nx, ny);
      // Mix the three CPPN channels as blend weights over the palette's three
      // jewel tones, then lift by the field's own luminance for depth.
      const w0 = c[0], w1 = c[1], w2 = c[2];
      const sum = w0 + w1 + w2 + 1e-4;
      const r = (tint[0][0] * w0 + tint[1][0] * w1 + tint[2][0] * w2) / sum;
      const g = (tint[0][1] * w0 + tint[1][1] * w1 + tint[2][1] * w2) / sum;
      const b = (tint[0][2] * w0 + tint[1][2] * w1 + tint[2][2] * w2) / sum;
      const lift = 0.35 + 0.65 * Math.max(w0, w1, w2);
      ctx.fillStyle = `rgb(${Math.round(r * lift)},${Math.round(g * lift)},${Math.round(b * lift)})`;
      ctx.fillRect(gx * cell, gy * cell, cell + 1, cell + 1);
    }
  }
  ctx.restore();
}

// The neural signed-distance surface. Sphere-march the seed's neural SDF from
// a fixed three-quarter camera, shade each hit by its surface normal (finite
// differences on the field) plus a rim light, over a deep ground. Rendered at
// a coarse march resolution and blitted, so the one-shot cost stays bounded.
function drawNeuralSdf(ctx, width, height, tick, seed, palette) {
  const sdf = buildNeuralSdf(seed);
  const tint = (palette && palette.fluid) || [[80, 196, 185], [167, 115, 255], [239, 171, 48]];
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(4,5,12,1)";
  ctx.fillRect(0, 0, width, height);

  // March into an offscreen buffer at a capped resolution, then let the browser
  // bilinearly upscale it to the canvas - smooth anti-aliased edges instead of
  // hard rects, and a 2000px plate stays as cheap as a strip. In a DOM-less
  // context (tests) fall back to fillRect so the code path still exercises.
  const RW = Math.min(360, Math.max(64, Math.round(width / 4)));
  const RH = Math.max(48, Math.round(RW * (height / Math.max(1, width))));
  const px = width / RW, py = height / RH;
  const aspect = RW / RH;
  const useBuffer = typeof document !== "undefined" && typeof document.createElement === "function";
  let offscreen = null, octx = null, imgData = null, buf = null;
  if (useBuffer) {
    offscreen = document.createElement("canvas");
    offscreen.width = RW; offscreen.height = RH;
    octx = offscreen.getContext("2d");
    imgData = octx.createImageData(RW, RH);
    buf = imgData.data;
  }
  // Orbit the camera around the origin (seed-varied 3/4 view) and always look
  // AT the object, so it stays framed regardless of yaw. Right/up basis from a
  // look-at, so ray dirs sweep a centred field of view.
  const yaw = -0.55 + rand(seed, 6001) * 1.1;
  const dist = 3.0;
  const eye = [Math.sin(yaw) * dist, 0.85, Math.cos(yaw) * dist];
  // forward = normalize(origin - eye)
  let fx = -eye[0], fy = -eye[1], fz = -eye[2];
  const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl;
  // right = normalize(forward x up)
  let rgx = fy * 0 - fz * 1, rgy = fz * 0 - fx * 0, rgz = fx * 1 - fy * 0;
  const rl = Math.hypot(rgx, rgy, rgz) || 1; rgx /= rl; rgy /= rl; rgz /= rl;
  // up = right x forward
  const upx = rgy * fz - rgz * fy, upy = rgz * fx - rgx * fz, upz = rgx * fy - rgy * fx;
  const fov = 0.72;
  const light = [-0.5, 0.75, 0.55];
  const ll = Math.hypot(light[0], light[1], light[2]);
  light[0] /= ll; light[1] /= ll; light[2] /= ll;
  const eps = 0.008;
  const maxSteps = 48;

  for (let j = 0; j < RH; j += 1) {
    const v = (0.5 - j / RH) * 2 * fov;
    for (let i = 0; i < RW; i += 1) {
      const u = (i / RW - 0.5) * 2 * fov * aspect;
      // Ray dir = forward + u*right + v*up (centred field of view, looks at origin).
      let dx = fx + u * rgx + v * upx;
      let dy = fy + u * rgy + v * upy;
      let dz = fz + u * rgz + v * upz;
      const dl = Math.hypot(dx, dy, dz) || 1;
      dx /= dl; dy /= dl; dz /= dl;
      let t = 0, hit = false;
      for (let s = 0; s < maxSteps; s += 1) {
        const x = eye[0] + dx * t, y = eye[1] + dy * t, z = eye[2] + dz * t;
        const d = sdf.dist(x, y, z);
        if (d < eps) { hit = true; break; }
        t += Math.max(0.012, d * 0.85);
        if (t > 6) break;
      }
      if (!hit) continue;
      const x = eye[0] + dx * t, y = eye[1] + dy * t, z = eye[2] + dz * t;
      // Normal by central differences on the field.
      const nx = sdf.dist(x + eps, y, z) - sdf.dist(x - eps, y, z);
      const ny = sdf.dist(x, y + eps, z) - sdf.dist(x, y - eps, z);
      const nz = sdf.dist(x, y, z + eps) - sdf.dist(x, y, z - eps);
      const nl = Math.hypot(nx, ny, nz) || 1;
      const nX = nx / nl, nY = ny / nl, nZ = nz / nl;
      const lam = Math.max(0.08, nX * light[0] + nY * light[1] + nZ * light[2]);
      const rim = Math.pow(1 - Math.max(0, -(dx * nx + dy * ny + dz * nz) / nl), 2.5);
      // Cheap ambient occlusion: step out along the normal and measure how much
      // the field lags behind free space - crevices darken, tips stay bright.
      let ao = 0;
      for (let a = 1; a <= 3; a += 1) {
        const dd = a * 0.06;
        ao += (dd - Math.max(0, sdf.dist(x + nX * dd, y + nY * dd, z + nZ * dd))) / dd;
      }
      ao = clamp(1 - ao / 3 * 0.7, 0.35, 1);
      // Colour by surface normal direction through the palette, lit by lambert.
      const w0 = (nX + 1) * 0.5, w1 = (nY + 1) * 0.5, w2 = (nZ + 1) * 0.5;
      const sum = w0 + w1 + w2 + 1e-4;
      const cr = (tint[0][0] * w0 + tint[1][0] * w1 + tint[2][0] * w2) / sum;
      const cg = (tint[0][1] * w0 + tint[1][1] * w1 + tint[2][1] * w2) / sum;
      const cb = (tint[0][2] * w0 + tint[1][2] * w1 + tint[2][2] * w2) / sum;
      const shade = (0.2 + lam * 0.8) * ao;
      // A restrained rim sheen (not a white blowout on thin grazing features).
      const R = Math.min(255, cr * shade + rim * ao * 70);
      const G = Math.min(255, cg * shade + rim * ao * 80);
      const B = Math.min(255, cb * shade + rim * ao * 96);
      if (buf) {
        const o = (j * RW + i) * 4;
        buf[o] = R; buf[o + 1] = G; buf[o + 2] = B; buf[o + 3] = 255;
      } else {
        ctx.fillStyle = `rgb(${Math.round(R)},${Math.round(G)},${Math.round(B)})`;
        ctx.fillRect(i * px, j * py, px + 1, py + 1);
      }
    }
  }
  if (buf) {
    octx.putImageData(imgData, 0, 0);
    const prevSmooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(offscreen, 0, 0, width, height);
    ctx.imageSmoothingEnabled = prevSmooth;
  }
  ctx.restore();
}

// The neural solid, voxelized. Sample the seed's neural SDF onto a cubic grid,
// then paint the surface voxels as isometric cubes (back-to-front, three faces
// each, shaded so the form reads as solid). A material becomes buildable blocks
// - the same field the raymarcher traces, now a MagicaVoxel-style model that
// also exports to voxel OBJ.
function drawNeuralVoxel(ctx, width, height, tick, seed, palette) {
  const sdf = buildNeuralSdf(seed);
  const res = 46;
  const vox = voxelizeSdf(sdf.dist, res, sdf.bound);
  const order = isoOrder(vox);
  const tint = (palette && palette.fluid) || [[80, 196, 185], [167, 115, 255], [239, 171, 48]];
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(5,6,13,1)";
  ctx.fillRect(0, 0, width, height);

  // Fit the isometric footprint to the frame. Iso span is ~ (nx+ny) wide and
  // (nx+ny)/2 + nz tall in unit cubes; pick a cube size that fits with margin.
  const spanX = (vox.nx + vox.ny);
  const spanY = (vox.nx + vox.ny) * 0.5 + vox.nz;
  const unit = Math.min(width / (spanX * 1.15), height / (spanY * 1.15));
  const ox = width / 2;
  const oy = height / 2 + (vox.nz * unit) * 0.28;
  const cx = vox.nx / 2, cy = vox.ny / 2, cz = vox.nz / 2;

  const shadeColor = (v, mul) => {
    // colour by field depth (how deep inside) through the palette, times a
    // per-face light multiplier.
    const t = clamp((v.z / vox.nz), 0, 1);
    const w0 = 1 - t, w1 = 1 - Math.abs(t - 0.5) * 2, w2 = t;
    const sum = w0 + w1 + w2 + 1e-4;
    const r = (tint[0][0] * w0 + tint[1][0] * w1 + tint[2][0] * w2) / sum;
    const g = (tint[0][1] * w0 + tint[1][1] * w1 + tint[2][1] * w2) / sum;
    const b = (tint[0][2] * w0 + tint[1][2] * w1 + tint[2][2] * w2) / sum;
    return `rgb(${Math.round(clamp(r * mul, 0, 255))},${Math.round(clamp(g * mul, 0, 255))},${Math.round(clamp(b * mul, 0, 255))})`;
  };
  const project = (gx, gy, gz) => [
    ox + (gx - cx - (gy - cy)) * unit,
    oy + ((gx - cx) + (gy - cy)) * unit * 0.5 - (gz - cz) * unit,
  ];

  for (const v of order) {
    const t = project(v.x, v.y, v.z + 1);        // top-front corner
    const uW = unit, uH = unit * 0.5;
    // top face (rhombus)
    if (v.top) {
      ctx.fillStyle = shadeColor(v, 1.15);
      ctx.beginPath();
      ctx.moveTo(t[0], t[1]);
      ctx.lineTo(t[0] + uW, t[1] + uH);
      ctx.lineTo(t[0], t[1] + unit);
      ctx.lineTo(t[0] - uW, t[1] + uH);
      ctx.closePath();
      ctx.fill();
    }
    // left face (down-left column)
    if (v.left) {
      ctx.fillStyle = shadeColor(v, 0.62);
      ctx.beginPath();
      ctx.moveTo(t[0] - uW, t[1] + uH);
      ctx.lineTo(t[0], t[1] + unit);
      ctx.lineTo(t[0], t[1] + unit + unit);
      ctx.lineTo(t[0] - uW, t[1] + uH + unit);
      ctx.closePath();
      ctx.fill();
    }
    // right face
    if (v.right) {
      ctx.fillStyle = shadeColor(v, 0.85);
      ctx.beginPath();
      ctx.moveTo(t[0] + uW, t[1] + uH);
      ctx.lineTo(t[0], t[1] + unit);
      ctx.lineTo(t[0], t[1] + unit + unit);
      ctx.lineTo(t[0] + uW, t[1] + uH + unit);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

// Art wave 3 (2026-07-10): three classical generative-art families, each a pure
// function of the seed - Truchet tiles, a Voronoi stained-glass, and a Clifford
// strange attractor. One-shot, deterministic, palette-tinted.

// Truchet tiles: each cell drops one of two quarter-circle pairs; the arcs join
// across cell edges into looping mazes. Seed picks the tile density and, per
// cell, the orientation and stroke weight.
function drawTruchet(ctx, width, height, tick, seed, palette) {
  const tones = palette.fluid || [[132, 245, 255], [167, 115, 255], [239, 171, 48]];
  const n = 9 + Math.floor(rand(seed, 5001) * 9);
  const cell = Math.min(width, height) / n;
  const cols = Math.ceil(width / cell), rows = Math.ceil(height / cell);
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(8,8,16,1)";
  ctx.fillRect(0, 0, width, height);
  ctx.lineCap = "round";
  for (let gy = 0; gy < rows; gy += 1) {
    for (let gx = 0; gx < cols; gx += 1) {
      const x = gx * cell, y = gy * cell, r = cell / 2;
      const tone = tones[(gx + gy) % tones.length];
      ctx.strokeStyle = toneToRgba(tone, 0.92);
      ctx.lineWidth = cell * (0.12 + rand(seed, gx * 7 + gy * 13 + 3) * 0.12);
      ctx.beginPath();
      if (rand(seed, gx * 131 + gy * 977 + 17) < 0.5) {
        ctx.arc(x, y, r, 0, Math.PI / 2);
        ctx.arc(x + cell, y + cell, r, Math.PI, Math.PI * 1.5);
      } else {
        ctx.arc(x + cell, y, r, Math.PI / 2, Math.PI);
        ctx.arc(x, y + cell, r, Math.PI * 1.5, Math.PI * 2);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

// Voronoi stained-glass: seed-scattered sites, each cell filled by its nearest
// site's tone with a distance shade, and dark leading drawn along cell borders.
function drawVoronoiStain(ctx, width, height, tick, seed, palette) {
  const tones = palette.fluid || [[132, 245, 255], [167, 115, 255], [239, 171, 48]];
  const K = 16 + Math.floor(rand(seed, 6001) * 26);
  const sites = [];
  for (let i = 0; i < K; i += 1) {
    sites.push({ x: rand(seed, i * 17 + 3) * width, y: rand(seed, i * 29 + 7) * height, tone: tones[i % tones.length] });
  }
  const cell = Math.max(3, Math.round(Math.min(width, height) / 240));
  const cols = Math.ceil(width / cell), rows = Math.ceil(height / cell);
  const diag = Math.hypot(width, height);
  const idx = new Int16Array(cols * rows);
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(6,7,14,1)";
  ctx.fillRect(0, 0, width, height);
  for (let gy = 0; gy < rows; gy += 1) {
    for (let gx = 0; gx < cols; gx += 1) {
      const px = gx * cell + cell / 2, py = gy * cell + cell / 2;
      let best = 0, bd = Infinity;
      for (let i = 0; i < K; i += 1) {
        const dx = px - sites[i].x, dy = py - sites[i].y, d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = i; }
      }
      idx[gy * cols + gx] = best;
      const t = sites[best].tone;
      const shade = 0.5 + 0.5 * (1 - clamp(Math.sqrt(bd) / (diag * 0.35), 0, 1));
      ctx.fillStyle = `rgb(${Math.round(t[0] * shade)},${Math.round(t[1] * shade)},${Math.round(t[2] * shade)})`;
      ctx.fillRect(gx * cell, gy * cell, cell + 1, cell + 1);
    }
  }
  // leading: a thin dark line wherever two cells belong to different sites.
  ctx.strokeStyle = "rgba(5,5,11,0.9)";
  ctx.lineWidth = Math.max(1, cell * 0.3);
  ctx.beginPath();
  for (let gy = 0; gy < rows; gy += 1) {
    for (let gx = 0; gx < cols; gx += 1) {
      const i = idx[gy * cols + gx];
      if (gx + 1 < cols && idx[gy * cols + gx + 1] !== i) { ctx.moveTo((gx + 1) * cell, gy * cell); ctx.lineTo((gx + 1) * cell, (gy + 1) * cell); }
      if (gy + 1 < rows && idx[(gy + 1) * cols + gx] !== i) { ctx.moveTo(gx * cell, (gy + 1) * cell); ctx.lineTo((gx + 1) * cell, (gy + 1) * cell); }
    }
  }
  ctx.stroke();
  ctx.restore();
}

// Clifford attractor: iterate x' = sin(a y) + c cos(a x), y' = sin(b x) + d cos(b y)
// with seed-chosen a,b,c,d, and additively plot the orbit into a glowing cloud.
function drawClifford(ctx, width, height, tick, seed, palette) {
  const tones = palette.fluid || [[132, 245, 255], [167, 115, 255], [239, 171, 48]];
  // Bias the constants away from the degenerate near-zero region: |a|,|b| large
  // enough to fold space, |c|,|d| moderate, so any seed lands on a rich orbit
  // rather than a collapsed fixed point.
  const sgn = (s) => (rand(seed, s) < 0.5 ? -1 : 1);
  const a = sgn(7005) * (1.3 + rand(seed, 7001) * 0.8);
  const b = sgn(7006) * (1.3 + rand(seed, 7002) * 0.8);
  const c = sgn(7007) * (0.5 + rand(seed, 7003) * 1.1);
  const d = sgn(7008) * (0.5 + rand(seed, 7004) * 1.1);
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(5,6,13,1)";
  ctx.fillRect(0, 0, width, height);
  const sx = width / (2 * (1 + Math.abs(c)) + 0.5);
  const sy = height / (2 * (1 + Math.abs(d)) + 0.5);
  const ox = width / 2, oy = height / 2;
  let x = 0.1, y = 0.1;
  const N = Math.min(360000, Math.max(60000, Math.round(width * height * 0.18)));
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < N; i += 1) {
    const nx = Math.sin(a * y) + c * Math.cos(a * x);
    const ny = Math.sin(b * x) + d * Math.cos(b * y);
    x = nx; y = ny;
    if (i < 24) continue;
    const px = ox + x * sx, py = oy + y * sy;
    const t = tones[(i >> 6) % tones.length];
    ctx.fillStyle = `rgba(${t[0]},${t[1]},${t[2]},0.12)`;
    ctx.fillRect(px, py, 1.5, 1.5);
  }
  ctx.restore();
}

// Phyllotaxis: the sunflower / pinecone spiral (Vogel's model). Each dot sits at
// angle i * the golden angle and radius proportional to sqrt(i); the seed detunes
// the angle a hair (so spirals differ), sets the count, the dot growth, and how
// the palette sweeps from center to rim.
function drawPhyllotaxis(ctx, width, height, tick, seed, palette) {
  const tones = palette.fluid || [[132, 245, 255], [167, 115, 255], [239, 171, 48]];
  const N = 700 + Math.floor(rand(seed, 8001) * 950);
  const golden = 137.508 * Math.PI / 180;
  const angle = golden + (rand(seed, 8002) - 0.5) * 0.045;
  const c = Math.min(width, height) / (2.2 * Math.sqrt(N));
  const cx = width / 2, cy = height / 2;
  const rot = rand(seed, 8003) * Math.PI * 2;
  const dotBase = c * (0.45 + rand(seed, 8004) * 0.55);
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(6,7,14,1)";
  ctx.fillRect(0, 0, width, height);
  for (let i = 0; i < N; i += 1) {
    const r = c * Math.sqrt(i);
    const th = i * angle + rot;
    const x = cx + r * Math.cos(th), y = cy + r * Math.sin(th);
    const f = i / N;
    const seg = f * tones.length;
    const t0 = tones[Math.floor(seg) % tones.length];
    const t1 = tones[(Math.floor(seg) + 1) % tones.length];
    const m = seg % 1;
    const R = Math.round(t0[0] * (1 - m) + t1[0] * m);
    const G = Math.round(t0[1] * (1 - m) + t1[1] * m);
    const B = Math.round(t0[2] * (1 - m) + t1[2] * m);
    ctx.fillStyle = `rgba(${R},${G},${B},${0.68 + 0.3 * f})`;
    ctx.beginPath();
    ctx.arc(x, y, dotBase * (0.35 + f * 0.95), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

const SPECIMEN_LAYERS = {
  orbit: drawOrbitField,
  contour: drawContourRidges,
  crystal: drawCrystalFragments,
  metaball: drawMetaballWashes,
  bands: drawMetaballContourBands,
  fluid: drawFluidCurl,
  hydra: drawHydraTiles,
  lamp: drawLampSymmetry,
  dither: drawDitheredPosterVeil,
  flow: drawFlowTraces,
  "crystal-lens": drawCrystalLens,
  scanline: drawScanlineHalftone,
  facets: drawFacetPlanes,
  groove: drawGrooveMarble,
  "ca-quadrant": drawCaQuadrant,
  "caustic-veils": drawCausticVeils,
  "caustic-paper": drawCausticPaper,
  "planet-limb": drawPlanetLimb,
  "aurora-leak": drawAuroraLeak,
  "obsidian-burst": drawObsidianBurst,
  dendrite: drawDendrite,
  "riso-moire": drawRisoMoire,
  "moire-swirl": drawMoireSwirl,
  "plotter-plate": drawPlotterPlate,
  "acid-duotone": drawAcidDuotone,
  databend: drawDatabendLayer,
  "stellated-lantern": drawStellatedLantern,
  "fiber-strands": drawFiberStrands,
  "pixel-sort-ruin": drawPixelSortRuin,
  "ifs-veil": drawIfsLightVeil,
  "dla-coral": drawDlaCoral,
  "weave-lattice": drawWeaveLattice,
  "fiber-terrain": drawFiberTerrain,
  "showpiece-lantern": drawShowpieceLantern,
  "showpiece-ruin": drawShowpieceRuin,
  "showpiece-veil": drawShowpieceVeil,
  "showpiece-burst": drawShowpieceBurst,
  "showpiece-weave": drawShowpieceWeave,
  "neural-field": drawNeuralField,
  "neural-sdf": drawNeuralSdf,
  "neural-voxel": drawNeuralVoxel,
  typeface: drawTypeface,
  truchet: drawTruchet,
  "voronoi-stain": drawVoronoiStain,
  clifford: drawClifford,
  phyllotaxis: drawPhyllotaxis,
};
const SPECIMEN_DEFAULT_LAYERS = ["orbit", "contour"];

// The registered layer vocabulary, for tests and for pages that want to list
// what canvas[data-specimen-layers] can request.
export function specimenLayerNames() {
  return Object.keys(SPECIMEN_LAYERS);
}

function sizeSpecimenCanvas(canvas, dpr) {
  // Unlike sizeCanvas above, never fall back to the window size: a strip that
  // has not been laid out yet should stay small, not inflate to the viewport.
  const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : null;
  const width = Math.max(1, Math.ceil((rect && rect.width) || canvas.clientWidth || 640));
  const height = Math.max(1, Math.ceil((rect && rect.height) || canvas.clientHeight || 150));
  const backingWidth = Math.max(1, Math.round(width * dpr));
  const backingHeight = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
    canvas.width = backingWidth;
    canvas.height = backingHeight;
  }
}

export function renderSpecimen(canvas, seedString, layerNames = SPECIMEN_DEFAULT_LAYERS) {
  if (!canvas || typeof canvas.getContext !== "function") return false;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return false;
  // Seeded mode is byte-stable. Seed "live" (or null) draws a true-random
  // one-off - sanctioned for exhibition plates that are one of one.
  const live = seedString == null || String(seedString).toLowerCase() === "live";
  const seed = live
    ? (Math.floor(Math.random() * 4294967295) >>> 0)
    : hashRoute(String(seedString || "specimen"));
  const palette = routePalette(seed);
  const dpr = Math.min(2, Math.max(1,
    (typeof window !== "undefined" && window.devicePixelRatio) || 1));
  sizeSpecimenCanvas(canvas, dpr);
  const width = canvas.width;
  const height = canvas.height;
  // Frozen instant: the layer functions take a clock tick, so derive one from
  // the seed. Same seed, same tick, same frame, every visit.
  const tick = 40000 + (seed % 50000);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  drawBackdrop(ctx, width, height, tick, seed, palette);
  const names = Array.isArray(layerNames) && layerNames.length
    ? layerNames : SPECIMEN_DEFAULT_LAYERS;
  for (const name of names) {
    const layer = SPECIMEN_LAYERS[String(name).trim()];
    if (layer) layer(ctx, width, height, tick, seed, palette);
  }
  ctx.globalCompositeOperation = "source-over";
  return true;
}

export function mountSpecimens(doc = typeof document !== "undefined" ? document : null) {
  if (!doc || typeof doc.querySelectorAll !== "function") return 0;
  let rendered = 0;
  doc.querySelectorAll("canvas[data-specimen]").forEach((canvas) => {
    if (canvas.dataset && canvas.dataset.specimenRendered === "true") return;
    const seedString = (canvas.dataset && canvas.dataset.specimen) || "specimen";
    const layers = ((canvas.dataset && canvas.dataset.specimenLayers) || "")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);
    if (renderSpecimen(canvas, seedString, layers.length ? layers : SPECIMEN_DEFAULT_LAYERS)) {
      if (canvas.dataset) canvas.dataset.specimenRendered = "true";
      rendered += 1;
    }
  });
  return rendered;
}

/* ---------------------------------------------------------------------------
   Editor primitives (2026-07-10): compositing helpers for the Studio's image
   editor. renderSpecimenOver lays the specimen vocabulary OVER whatever the
   canvas already holds (an imported photograph, a prior render) - no clear,
   no backdrop wash - and drawImageFit establishes that base image at its own
   resolution. Neither registers anything in SPECIMEN_LAYERS: these compose
   the existing library, they do not extend it.
--------------------------------------------------------------------------- */

// Like renderSpecimen, but composites the named layers over the existing
// canvas content: no clearRect, no drawBackdrop. opts.alpha (0..1, default 1)
// scales layer opacity via ctx.globalAlpha. Seed semantics match
// renderSpecimen: "live"/null is a true-random one-off, any other string is
// byte-stable. Unknown layer names are skipped.
export function renderSpecimenOver(canvas, seedString, layerNames, opts = {}) {
  if (!canvas || typeof canvas.getContext !== "function") return false;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return false;
  const live = seedString == null || String(seedString).toLowerCase() === "live";
  const seed = live
    ? (Math.floor(Math.random() * 4294967295) >>> 0)
    : hashRoute(String(seedString || "specimen"));
  const palette = routePalette(seed);
  // The editor draws over an imported image at ITS resolution: never resize a
  // canvas that already has a backing (resizing wipes the bitmap). Only an
  // empty 0x0 backing gets sized from its element box.
  if (!canvas.width || !canvas.height) {
    const dpr = Math.min(2, Math.max(1,
      (typeof window !== "undefined" && window.devicePixelRatio) || 1));
    sizeSpecimenCanvas(canvas, dpr);
  }
  const width = canvas.width;
  const height = canvas.height;
  // Frozen instant, same derivation as renderSpecimen: seed in, tick out.
  const tick = 40000 + (seed % 50000);
  const alpha = typeof opts.alpha === "number" ? clamp(opts.alpha, 0, 1) : 1;
  const names = Array.isArray(layerNames) ? layerNames : [];
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (const name of names) {
    const layer = SPECIMEN_LAYERS[String(name).trim()];
    if (!layer) continue;
    // Re-asserted per layer: a layer may reset globalAlpha internally (the
    // databend fringe pass does) and the next layer must still scale.
    ctx.globalAlpha = alpha;
    layer(ctx, width, height, tick, seed, palette);
  }
  ctx.restore();
  ctx.globalCompositeOperation = "source-over";
  return true;
}

// Sizes the canvas backing from opts.width/height when given (one edge given
// derives the other from the image aspect), else from the image's natural
// size capped at opts.maxBacking || 2048 on the long edge (aspect preserved,
// never upscaled). Draws the image cover-fit: fills both axes, centered, the
// overflow axis cropped. Returns { width, height } or null on bad input.
export function drawImageFit(canvas, imgLike, opts = {}) {
  if (!canvas || typeof canvas.getContext !== "function" || !imgLike) return null;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return null;
  const naturalW = Math.max(1, Math.round(
    imgLike.naturalWidth || imgLike.videoWidth || imgLike.width || 1));
  const naturalH = Math.max(1, Math.round(
    imgLike.naturalHeight || imgLike.videoHeight || imgLike.height || 1));
  const optW = Number(opts.width) > 0 ? Math.round(Number(opts.width)) : 0;
  const optH = Number(opts.height) > 0 ? Math.round(Number(opts.height)) : 0;
  let width;
  let height;
  if (optW && optH) {
    width = optW;
    height = optH;
  } else if (optW || optH) {
    width = optW || Math.max(1, Math.round(optH * (naturalW / naturalH)));
    height = optH || Math.max(1, Math.round(optW * (naturalH / naturalW)));
  } else {
    const maxBacking = Math.max(1, Math.floor(opts.maxBacking) || 2048);
    const scale = Math.min(1, maxBacking / Math.max(naturalW, naturalH));
    width = Math.max(1, Math.round(naturalW * scale));
    height = Math.max(1, Math.round(naturalH * scale));
  }
  canvas.width = width;
  canvas.height = height;
  const cover = Math.max(width / naturalW, height / naturalH);
  const drawW = naturalW * cover;
  const drawH = naturalH * cover;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(imgLike, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH);
  return { width, height };
}

if (typeof document !== "undefined" && !document.body?.dataset.deferGenerativeField) {
  const bootField = () => {
    mountGenerativeField();
    mountSpecimens();
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootField, { once: true });
  } else {
    bootField();
  }
}
