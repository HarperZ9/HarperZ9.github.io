// reactive-music-ui.js
// Wires the Music tab controls in studio.html to window.MusicExperience.
// This module runs AFTER reactive.js is loaded (it sets window.MusicExperience).
// It does NOT import reactive.js to avoid circular loading; it reads window.MusicExperience.
// Zero external dependencies.

(function() {
  // Wait until DOM + MusicExperience are ready.
  function init() {
    const ME = window.MusicExperience;
    if (!ME) { setTimeout(init, 50); return; }
    wireMusicUI(ME);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  function wireMusicUI(ME) {
    const $ = id => document.getElementById(id);

    // ── Source selection ──────────────────────────────────────────────────
    let activeSource = "synth"; // "synth" | "mic" | "file"

    function setAudioSourceUI(src) {
      activeSource = src;
      ["synth", "mic", "file"].forEach(s => {
        const btn = $("music-src-" + s);
        if (btn) btn.classList.toggle("active", s === src);
      });
      const fileRow = $("music-file-row");
      if (fileRow) fileRow.hidden = src !== "file";
    }

    $("music-src-synth") && $("music-src-synth").addEventListener("click", () => setAudioSourceUI("synth"));
    $("music-src-mic")   && $("music-src-mic").addEventListener("click", () => setAudioSourceUI("mic"));
    $("music-src-file")  && $("music-src-file").addEventListener("click", () => setAudioSourceUI("file"));

    // File chooser
    const audioEl = $("music-audio-el");
    const fileInput = $("music-file");
    const fileChooseBtn = $("music-file-choose");
    const fileNameEl = $("music-file-name");

    if (fileChooseBtn && fileInput) {
      fileChooseBtn.addEventListener("click", () => fileInput.click());
    }
    if (fileInput) {
      fileInput.addEventListener("change", e => {
        const f = e.target.files[0];
        if (!f) return;
        if (fileNameEl) fileNameEl.textContent = f.name;
        if (audioEl) {
          audioEl.hidden = false;
          if (audioEl.src && audioEl.src.startsWith("blob:")) URL.revokeObjectURL(audioEl.src);
          audioEl.src = URL.createObjectURL(f);
          audioEl.load();
        }
        setStatus("Track loaded: " + f.name);
      });
    }

    // ── Play / Stop ───────────────────────────────────────────────────────
    const playBtn = $("music-play"), stopBtn = $("music-stop");

    function setPlayState(playing) {
      if (playBtn) { playBtn.textContent = playing ? "Playing..." : "Play"; playBtn.disabled = playing; }
      if (stopBtn) stopBtn.disabled = !playing;
    }

    function setStatus(msg) {
      const el = $("music-status");
      if (el) el.textContent = msg || "";
    }

    function buildSourceSpec() {
      if (activeSource === "synth") return { kind: "synth" };
      if (activeSource === "mic")   return { kind: "mic" };
      if (activeSource === "file") {
        if (!audioEl || !audioEl.src) {
          setStatus("Choose a track file first.");
          return null;
        }
        return { kind: "element", el: audioEl };
      }
      return { kind: "synth" };
    }

    if (playBtn) {
      playBtn.addEventListener("click", () => {
        if (ME.running) return;
        const spec = buildSourceSpec();
        if (!spec) return;
        // The reactive engine draws over the canvas; stop other animated loops that own the canvas
        // (n-dim RAF, the 3D orbit). Do NOT stop the meter loop: for music the loop only READS the
        // canvas pixels (it never clears or draws), so it does not compete with the reactive engine.
        // Stopping it was the freeze bug. We (re-)arm it below so the measurimeter tracks the visuals.
        if (typeof window.__studioStopNDim === "function") window.__studioStopNDim();
        if (typeof window.__studioLeave3D === "function") window.__studioLeave3D();
        // Play the audio element if file-mode and paused
        if (spec.kind === "element" && audioEl) {
          audioEl.play().catch(() => {});
        }
        ME.start(spec);
        // Re-arm the Studio perception loop so the measurimeter reads the live music visuals. The
        // loop's sourceIsAnimated() guard keeps it from self-idling on a static hash in music mode.
        if (typeof window.__studioStartMeterLoop === "function") window.__studioStartMeterLoop();
        setPlayState(true);
        setStatus(activeSource === "synth" ? "Built-in synth running." : activeSource === "mic" ? "Listening via microphone..." : "Playing track.");
        // Register a beat callback that pings the perception channel
        ME.onBeat(features => {
          window.__reactiveCurrentFeatures = features;
        });
      });
    }

    if (stopBtn) {
      stopBtn.addEventListener("click", () => {
        ME.stop();
        if (audioEl) { try { audioEl.pause(); } catch (_) {} }
        setPlayState(false);
        setStatus("Stopped.");
        // Restart the Studio meter loop so the visual panel comes back
        if (typeof window.__studioStartMeterLoop === "function") window.__studioStartMeterLoop();
      });
    }

    // ── Visual mode chips ─────────────────────────────────────────────────
    document.querySelectorAll("[data-music-mode]").forEach(btn => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.musicMode;
        ME.setMode(mode);
        document.querySelectorAll("[data-music-mode]").forEach(b => b.classList.toggle("active", b === btn));
        // Show/hide attractor type row
        const row = $("music-attractor-row");
        if (row) row.hidden = mode !== "attractor";
      });
    });
    // Hide attractor row by default (particles mode is active)
    const attrRow = $("music-attractor-row");
    if (attrRow) attrRow.hidden = true;

    // ── Attractor type chips ──────────────────────────────────────────────
    document.querySelectorAll("[data-attr-type]").forEach(btn => {
      btn.addEventListener("click", () => {
        ME.setAttractorType(btn.dataset.attrType);
        document.querySelectorAll("[data-attr-type]").forEach(b => b.classList.toggle("active", b === btn));
      });
    });

    // ── Mapping preset chips ──────────────────────────────────────────────
    document.querySelectorAll("[data-music-preset]").forEach(btn => {
      btn.addEventListener("click", () => {
        ME.setMapping(btn.dataset.musicPreset);
        document.querySelectorAll("[data-music-preset]").forEach(b => b.classList.toggle("active", b === btn));
        // Merge the current sensitivity into the preset
        syncSensitivity();
      });
    });

    // ── Sensitivity slider ────────────────────────────────────────────────
    const sensSlider = $("music-sensitivity"), sensVal = $("music-sens-val");
    let _currentPreset = "default";

    function syncSensitivity() {
      const s = sensSlider ? parseFloat(sensSlider.value) : 1;
      const presetConfig = Object.assign({}, (ME.PRESETS && ME.PRESETS[_currentPreset]) || {});
      presetConfig.sensitivity = s;
      ME.setMapping(presetConfig);
    }

    if (sensSlider) {
      sensSlider.addEventListener("input", () => {
        if (sensVal) sensVal.textContent = parseFloat(sensSlider.value).toFixed(1);
        syncSensitivity();
      });
    }

    // Update _currentPreset when a preset chip is clicked
    document.querySelectorAll("[data-music-preset]").forEach(btn => {
      btn.addEventListener("click", () => { _currentPreset = btn.dataset.musicPreset; });
    });

    // ── Reactive sound toggle + level ────────────────────────────────────
    const soundToggle = $("music-sound-toggle");
    const soundLevelSlider = $("music-sound-level");

    if (soundToggle) {
      soundToggle.addEventListener("click", () => {
        const on = soundToggle.getAttribute("aria-pressed") !== "true";
        ME.setSoundEnabled(on);
        soundToggle.setAttribute("aria-pressed", String(on));
        soundToggle.textContent = on ? "Sound on" : "Sound off";
      });
    }

    if (soundLevelSlider) {
      soundLevelSlider.addEventListener("input", () => {
        ME.setSoundLevel(parseFloat(soundLevelSlider.value));
      });
    }

    // ── Integrate into the Studio source lifecycle ────────────────────────
    // Music is now a first-class entry in studio.js's SOURCES map, so setSource("music") performs
    // the show/hide + aria-selected exactly like every other tab (no manual tab-switch hack here).
    // The one music-specific concern setSource does NOT own is the reactive ENGINE: when the user
    // leaves the Music tab we must stop ME. The Studio's own setSource() handles the meter loop for
    // the new source, so we only stop the engine + reset the music controls here.
    const sourceMenu = document.getElementById("studio-source");
    if (sourceMenu) {
      sourceMenu.addEventListener("click", e => {
        const btn = e.target.closest("button[data-source]");
        if (!btn) return;
        if (btn.dataset.source !== "music" && ME.running) {
          ME.stop();
          setPlayState(false);
          setStatus("");
        }
      });
    }

    // ── Idle frame when music mode is active but stopped ──────────────────
    let _idleRaf = null;
    let _idleTs = 0;
    function idleTick(ts) {
      const musicBlock = document.getElementById("src-music");
      if (!musicBlock || musicBlock.hidden) { _idleRaf = null; return; }
      if (ME.running) { _idleRaf = null; return; }
      const canvas = document.getElementById("studio-canvas");
      if (canvas && window.ReactiveVisuals) {
        const t = (ts - _idleTs) / 1000;
        window.ReactiveVisuals.drawIdle(canvas, t);
      }
      _idleRaf = requestAnimationFrame(idleTick);
    }

    // Start the idle loop when the music tab becomes active but nothing plays
    const musicTab = document.querySelector('#studio-source button[data-source="music"]');
    if (musicTab) {
      musicTab.addEventListener("click", () => {
        if (!ME.running && !_idleRaf) {
          _idleTs = performance.now();
          _idleRaf = requestAnimationFrame(idleTick);
        }
      });
    }

    // ── Bridge live features into the Studio measurimeter ────────────────
    // reactive.js calls window.__studioReactiveAudioBridge(features) every animation frame; studio.js
    // registers that receiver and pushes the real music features (level / chroma-derived pitch /
    // 3-band+chroma spectrum) into the audio-meter row. The live features are also always mirrored on
    // window.__reactiveCurrentFeatures for any other consumer. Nothing to wire from here.

    setPlayState(false);
    setStatus("");
  }
})();
