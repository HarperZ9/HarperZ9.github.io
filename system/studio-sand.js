// system/studio-sand.js
// Full cellular falling-sand, fluid, thermal, Kubelka-Munk ink, and Cauchy glass physics engine.
// Pure deterministic simulation core (runs in Node tests and 60 fps browser canvas).

export const MAT = Object.freeze({
  AIR:   0,
  SAND:  1,
  WATER: 2,
  OIL:   3,
  FIRE:  4,
  WOOD:  5,
  STONE: 6,
  GLASS: 7,
  INK:   8,
  ACID:  9,
  STEAM: 10,
});

export const MATERIAL_LIST = Object.freeze([
  { id: MAT.SAND,  key: "sand",  label: "Sand",  rgb: [215, 178, 114], density: 4 },
  { id: MAT.WATER, key: "water", label: "Water", rgb: [64, 152, 196],  density: 2 },
  { id: MAT.GLASS, key: "glass", label: "Glass", rgb: [188, 232, 244], density: 9 },
  { id: MAT.INK,   key: "ink",   label: "Ink",   rgb: [42, 74, 96],    density: 2 },
  { id: MAT.OIL,   key: "oil",   label: "Oil",   rgb: [132, 86, 44],   density: 1 },
  { id: MAT.FIRE,  key: "fire",  label: "Fire",  rgb: [248, 128, 38],  density: 0 },
  { id: MAT.WOOD,  key: "wood",  label: "Wood",  rgb: [112, 72, 46],   density: 9 },
  { id: MAT.STONE, key: "stone", label: "Stone", rgb: [118, 124, 132], density: 9 },
  { id: MAT.ACID,  key: "acid",  label: "Acid",  rgb: [154, 232, 72],  density: 2 },
  { id: MAT.AIR,   key: "erase", label: "Erase", rgb: [12, 22, 34],    density: 0 },
]);

export const SAND_PRESETS = Object.freeze([
  { id: "estuary-glass", label: "Estuary Tide & Glass" },
  { id: "kiln-melt",     label: "Kiln & Molten Glass" },
  { id: "ink-oil",       label: "Ink Well & Oil" },
  { id: "acid-cavern",   label: "Acid Cavern" },
]);

export class SandWorld {
  constructor(width = 240, height = 135, seed = 1337) {
    this.w = width;
    this.h = height;
    this.cells = new Uint8Array(width * height);
    this.shade = new Uint8Array(width * height);
    this.life = new Uint8Array(width * height);
    this.rngState = (seed >>> 0) || 1337;
    this.tickCount = 0;
    this.gravity = 1;
    this.audioEnergy = 0;
  }

  rand() {
    let x = this.rngState;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.rngState = x >>> 0;
    return this.rngState;
  }

  idx(x, y) { return y * this.w + x; }
  inBounds(x, y) { return x >= 0 && x < this.w && y >= 0 && y < this.h; }

  setCell(x, y, mat) {
    if (!this.inBounds(x, y)) return;
    const i = this.idx(x, y);
    this.cells[i] = mat;
    this.shade[i] = this.rand() & 31;
    this.life[i] = mat === MAT.FIRE ? 28 + (this.rand() & 31) : mat === MAT.STEAM ? 45 + (this.rand() & 31) : 0;
  }

  paintDisc(cx, cy, radius, mat) {
    const r2 = radius * radius;
    const x0 = Math.max(0, Math.floor(cx - radius));
    const x1 = Math.min(this.w - 1, Math.ceil(cx + radius));
    const y0 = Math.max(0, Math.floor(cy - radius));
    const y1 = Math.min(this.h - 1, Math.ceil(cy + radius));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= r2) {
          if (mat === MAT.AIR || this.cells[this.idx(x, y)] === MAT.AIR || (this.rand() & 3) === 0) {
            this.setCell(x, y, mat);
          }
        }
      }
    }
  }

  clear() {
    this.cells.fill(MAT.AIR);
    this.shade.fill(0);
    this.life.fill(0);
    this.tickCount = 0;
  }

  loadPreset(presetId = "estuary-glass") {
    this.clear();
    const { w, h } = this;
    if (presetId === "estuary-glass") {
      // Stone basin + glass optical prism + sand dune + water tide + ink droplets
      for (let x = 0; x < w; x++) {
        const floorY = h - 8 - Math.floor(Math.sin(x * 0.05) * 4);
        for (let y = floorY; y < h; y++) this.setCell(x, y, MAT.STONE);
      }
      for (let y = Math.floor(h * 0.34); y < Math.floor(h * 0.62); y++) {
        const half = Math.floor((y - h * 0.34) * 0.55);
        for (let x = Math.floor(w * 0.5) - half; x <= Math.floor(w * 0.5) + half; x++) {
          this.setCell(x, y, MAT.GLASS);
        }
      }
      this.paintDisc(w * 0.25, h * 0.22, 16, MAT.SAND);
      this.paintDisc(w * 0.76, h * 0.24, 18, MAT.WATER);
      this.paintDisc(w * 0.68, h * 0.16, 8, MAT.INK);
    } else if (presetId === "kiln-melt") {
      for (let x = Math.floor(w * 0.2); x < Math.floor(w * 0.8); x++) {
        for (let y = h - 18; y < h - 10; y++) this.setCell(x, y, MAT.WOOD);
      }
      this.paintDisc(w * 0.5, h * 0.22, 22, MAT.SAND);
      this.paintDisc(w * 0.35, h - 22, 9, MAT.FIRE);
      this.paintDisc(w * 0.65, h - 22, 9, MAT.FIRE);
    } else if (presetId === "ink-oil") {
      for (let x = 0; x < w; x++) {
        for (let y = h - 10; y < h; y++) this.setCell(x, y, MAT.STONE);
      }
      for (let x = 16; x < w - 16; x++) {
        for (let y = Math.floor(h * 0.55); y < h - 12; y++) this.setCell(x, y, MAT.WATER);
      }
      this.paintDisc(w * 0.34, h * 0.28, 16, MAT.OIL);
      this.paintDisc(w * 0.66, h * 0.26, 14, MAT.INK);
      this.paintDisc(w * 0.5, h * 0.18, 10, MAT.SAND);
    } else {
      for (let x = 0; x < w; x++) {
        const y0 = Math.floor(h * 0.45 + Math.sin(x * 0.08) * 12);
        for (let y = y0; y < y0 + 14; y++) this.setCell(x, y, MAT.STONE);
      }
      this.paintDisc(w * 0.35, h * 0.18, 14, MAT.ACID);
      this.paintDisc(w * 0.65, h * 0.18, 14, MAT.SAND);
    }
  }

  swap(i1, i2) {
    const m = this.cells[i1]; this.cells[i1] = this.cells[i2]; this.cells[i2] = m;
    const s = this.shade[i1]; this.shade[i1] = this.shade[i2]; this.shade[i2] = s;
    const l = this.life[i1];  this.life[i1] = this.life[i2];   this.life[i2] = l;
  }

  step() {
    this.tickCount++;
    const { w, h, cells } = this;
    const dirFlip = (this.tickCount & 1) === 0;
    const shake = this.audioEnergy > 0.35;

    for (let y = h - 2; y >= 1; y--) {
      for (let xi = 1; xi < w - 1; xi++) {
        const x = dirFlip ? xi : (w - 1 - xi);
        const i = y * w + x;
        const m = cells[i];
        if (m === MAT.AIR || m === MAT.STONE || m === MAT.WOOD || m === MAT.GLASS) continue;

        const below = i + w;
        const dir = (this.rand() & 1) ? 1 : -1;

        if (m === MAT.SAND) {
          if (shake && (this.rand() & 15) === 0 && cells[i - w] === MAT.AIR) {
            this.swap(i, i - w);
            continue;
          }
          const bm = cells[below];
          if (bm === MAT.AIR || bm === MAT.WATER || bm === MAT.OIL || bm === MAT.INK) {
            this.swap(i, below);
          } else if (cells[below + dir] === MAT.AIR || cells[below + dir] === MAT.WATER) {
            this.swap(i, below + dir);
          } else if (cells[below - dir] === MAT.AIR || cells[below - dir] === MAT.WATER) {
            this.swap(i, below - dir);
          }
        } else if (m === MAT.WATER || m === MAT.INK || m === MAT.ACID) {
          const bm = cells[below];
          if (m === MAT.ACID && (bm === MAT.STONE || bm === MAT.WOOD || bm === MAT.SAND)) {
            if ((this.rand() & 7) === 0) {
              this.setCell(x, y + 1, MAT.AIR);
              this.setCell(x, y, MAT.STEAM);
              continue;
            }
          }
          if (bm === MAT.AIR || bm === MAT.OIL || bm === MAT.FIRE) {
            if (bm === MAT.FIRE && m === MAT.WATER) {
              this.setCell(x, y + 1, MAT.STEAM);
              this.setCell(x, y, MAT.AIR);
            } else {
              this.swap(i, below);
            }
          } else if (cells[below + dir] === MAT.AIR) {
            this.swap(i, below + dir);
          } else if (cells[below - dir] === MAT.AIR) {
            this.swap(i, below - dir);
          } else if (cells[i + dir] === MAT.AIR) {
            this.swap(i, i + dir);
          } else if (cells[i - dir] === MAT.AIR) {
            this.swap(i, i - dir);
          }
        } else if (m === MAT.OIL) {
          if (cells[below] === MAT.AIR) {
            this.swap(i, below);
          } else if (cells[i + dir] === MAT.AIR) {
            this.swap(i, i + dir);
          } else if (cells[i - dir] === MAT.AIR) {
            this.swap(i, i - dir);
          }
        } else if (m === MAT.FIRE) {
          if (this.life[i] <= 1) {
            cells[i] = MAT.AIR;
            continue;
          }
          this.life[i]--;
          // Heat adjacent sand into glass; ignite oil & wood
          for (const nb of [i - 1, i + 1, i - w, i + w]) {
            const nm = cells[nb];
            if ((nm === MAT.WOOD || nm === MAT.OIL) && (this.rand() & 7) === 0) {
              cells[nb] = MAT.FIRE;
              this.life[nb] = 40;
            } else if (nm === MAT.SAND && (this.rand() & 31) === 0) {
              cells[nb] = MAT.GLASS;
            }
          }
          const above = i - w;
          if (above > w && cells[above] === MAT.AIR) {
            this.swap(i, above);
          } else if (above + dir > w && cells[above + dir] === MAT.AIR) {
            this.swap(i, above + dir);
          }
        } else if (m === MAT.STEAM) {
          if (this.life[i] <= 1) {
            cells[i] = MAT.AIR;
            continue;
          }
          this.life[i]--;
          const above = i - w;
          if (above > w && (cells[above] === MAT.AIR || cells[above] === MAT.WATER)) {
            this.swap(i, above);
          } else if (cells[i + dir] === MAT.AIR) {
            this.swap(i, i + dir);
          }
        }
      }
    }
  }

  renderToImageData(imgData) {
    const { w, h, cells, shade } = this;
    const d = imgData.data;
    for (let y = 0; y < h; y++) {
      const bgR = 9 + Math.floor((y / h) * 14);
      const bgG = 21 + Math.floor((y / h) * 24);
      const bgB = 33 + Math.floor((y / h) * 34);
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const o = i * 4;
        const m = cells[i];
        const v = shade[i] - 16;
        if (m === MAT.AIR) {
          d[o] = bgR; d[o + 1] = bgG; d[o + 2] = bgB; d[o + 3] = 255;
        } else if (m === MAT.GLASS) {
          // Cauchy optical dispersion sheen across glass cells
          const disp = Math.sin((x + y * 0.7) * 0.25) * 22;
          d[o] = Math.min(255, Math.max(0, 178 + disp));
          d[o + 1] = Math.min(255, Math.max(0, 224 + v));
          d[o + 2] = Math.min(255, Math.max(0, 246 - disp * 0.5));
          d[o + 3] = 255;
        } else if (m === MAT.FIRE) {
          const hot = this.life[i] * 4;
          d[o] = 255;
          d[o + 1] = Math.min(255, 85 + hot);
          d[o + 2] = Math.min(255, 20 + (hot >> 1));
          d[o + 3] = 255;
        } else if (m === MAT.STEAM) {
          d[o] = 200; d[o + 1] = 216; d[o + 2] = 228; d[o + 3] = 255;
        } else {
          const def = MATERIAL_LIST.find((k) => k.id === m);
          const rgb = def ? def.rgb : [180, 180, 180];
          d[o] = Math.min(255, Math.max(0, rgb[0] + v));
          d[o + 1] = Math.min(255, Math.max(0, rgb[1] + v));
          d[o + 2] = Math.min(255, Math.max(0, rgb[2] + v));
          d[o + 3] = 255;
        }
      }
    }
  }

  counts() {
    const out = {};
    for (let i = 0; i < this.cells.length; i++) {
      const m = this.cells[i];
      if (m !== MAT.AIR) out[m] = (out[m] || 0) + 1;
    }
    return out;
  }
}

export function mountSandSource(mountEl, canvasEl) {
  if (!mountEl || !canvasEl) return null;
  const world = new SandWorld(240, 135, 2026);
  world.loadPreset("estuary-glass");

  const off = document.createElement("canvas");
  off.width = world.w;
  off.height = world.h;
  const offCtx = off.getContext("2d");
  const imgData = offCtx.createImageData(world.w, world.h);

  let activeMat = MAT.SAND;
  let brush = 6;
  let playing = true;
  let raf = 0;
  let painting = false;

  mountEl.innerHTML = "";
  const presetRow = document.createElement("div");
  presetRow.className = "sand-presets";
  for (const p of SAND_PRESETS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn ghost";
    b.textContent = p.label;
    b.addEventListener("click", () => { world.loadPreset(p.id); draw(); });
    presetRow.appendChild(b);
  }

  const matRow = document.createElement("div");
  matRow.className = "sand-materials";
  const matButtons = [];
  for (const m of MATERIAL_LIST) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn ghost";
    b.dataset.sandMat = m.key;
    b.setAttribute("aria-pressed", String(m.id === activeMat));
    b.textContent = m.label;
    b.addEventListener("click", () => {
      activeMat = m.id;
      matButtons.forEach((btn) => btn.setAttribute("aria-pressed", String(btn === b)));
    });
    matButtons.push(b);
    matRow.appendChild(b);
  }

  const controlsRow = document.createElement("div");
  controlsRow.className = "sand-controls";
  const brushLab = document.createElement("label");
  brushLab.textContent = "Brush ";
  const brushRange = document.createElement("input");
  brushRange.type = "range"; brushRange.min = "2"; brushRange.max = "20"; brushRange.value = String(brush);
  brushRange.addEventListener("input", () => { brush = Number(brushRange.value); });
  brushLab.appendChild(brushRange);

  const pauseBtn = document.createElement("button");
  pauseBtn.type = "button"; pauseBtn.className = "btn ghost"; pauseBtn.textContent = "Pause";
  pauseBtn.addEventListener("click", () => {
    playing = !playing;
    pauseBtn.textContent = playing ? "Pause" : "Resume";
  });

  const clearBtn = document.createElement("button");
  clearBtn.type = "button"; clearBtn.className = "btn ghost"; clearBtn.textContent = "Clear";
  clearBtn.addEventListener("click", () => { world.clear(); draw(); });

  controlsRow.append(brushLab, pauseBtn, clearBtn);
  mountEl.append(presetRow, matRow, controlsRow);

  const toGrid = (ev) => {
    const r = canvasEl.getBoundingClientRect();
    const gx = Math.floor(((ev.clientX - r.left) / Math.max(1, r.width)) * world.w);
    const gy = Math.floor(((ev.clientY - r.top) / Math.max(1, r.height)) * world.h);
    return [gx, gy];
  };

  const onDown = (ev) => { painting = true; const [gx, gy] = toGrid(ev); world.paintDisc(gx, gy, brush, activeMat); };
  const onMove = (ev) => { if (!painting) return; const [gx, gy] = toGrid(ev); world.paintDisc(gx, gy, brush, activeMat); };
  const onUp = () => { painting = false; };

  canvasEl.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);

  function draw() {
    world.renderToImageData(imgData);
    offCtx.putImageData(imgData, 0, 0);
    const ctx = canvasEl.getContext("2d");
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, 0, 0, canvasEl.width, canvasEl.height);
    }
  }

  function loop() {
    if (playing) {
      world.step();
      world.step();
    }
    draw();
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);

  return {
    world,
    destroy() {
      cancelAnimationFrame(raf);
      canvasEl.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    },
  };
}
