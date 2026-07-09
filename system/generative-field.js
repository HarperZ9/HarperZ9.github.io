// First-party procedural field for shared Project Telos pages.
// Synthesizes route-seeded orbit fields, contour ridges, crystal fragments,
// fluid metaballs, iso-contours, ASCII dither, flow traces, pointer wakes, and
// motes. No copied inspiration images, no remote textures.
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
  const onScroll = () => markInteraction(performance.now());
  const onKeyDown = () => {
    const tick = performance.now();
    addPulse(0.5 + Math.sin(tick * 0.003 + seed) * 0.18, 0.52 + Math.cos(tick * 0.002 + seed) * 0.12, tick);
    markInteraction(tick);
  };

  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerdown", onPointerDown, { passive: true });
  window.addEventListener("scroll", onScroll, { passive: true });
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

if (typeof document !== "undefined" && !document.body?.dataset.deferGenerativeField) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { mountGenerativeField(); }, { once: true });
  } else {
    mountGenerativeField();
  }
}
