// First-party procedural field for shared Project Telos pages.
// Synthesizes route-seeded orbit fields, contour ridges, crystal fragments,
// fluid metaballs, ASCII dither, flow traces, and motes. No copied inspiration
// images, no remote textures.
let mounted = false;
let rafId = 0;

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
  const width = Math.max(1, Math.ceil(window.innerWidth));
  const height = Math.max(1, Math.ceil(window.innerHeight));
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

function orderedDither(x, y) {
  const matrix = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];
  return (matrix[y & 3][x & 3] + 0.5) / 16;
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

function drawField(ctx, width, height, tick, seed, palette) {
  ctx.clearRect(0, 0, width, height);
  drawBackdrop(ctx, width, height, tick, seed, palette);
  drawMetaballWashes(ctx, width, height, tick, seed, palette);
  drawAsciiMetaballField(ctx, width, height, tick, seed, palette);
  drawFluidCurl(ctx, width, height, tick, seed, palette);
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

  if (!sceneCtx) {
    document.documentElement.classList.add("generative-field-failed");
    return false;
  }

  const render = (tick = 0) => {
    if (!still && tick - lastRendered < 42) {
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
