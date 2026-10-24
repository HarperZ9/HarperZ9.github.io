// A quiet generative drone, off until the visitor turns it on. Two detuned
// voices on the facet's note, a slow filter sweep, and a soft bell when a
// facet opens or the form is touched.

const NOTES = [110, 123.47, 130.81, 146.83, 164.81, 174.61, 196, 220]; // A minor, one octave

export type Sound = { setOn(on: boolean): void; facet(i: number): void; touch(kind: string): void; on(): boolean };

export function createSound(): Sound {
  let ac: AudioContext | null = null;
  let master: GainNode | null = null;
  let voices: OscillatorNode[] = [];
  let enabled = false;

  const build = () => {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) throw new Error("no Web Audio in this browser");
    ac = new Ctor();
    master = ac.createGain();
    master.gain.value = 0;
    const filter = ac.createBiquadFilter();
    filter.type = "lowpass"; filter.frequency.value = 600; filter.Q.value = 6;
    const lfo = ac.createOscillator(); lfo.frequency.value = 0.07;
    const lfoGain = ac.createGain(); lfoGain.gain.value = 420;
    lfo.connect(lfoGain).connect(filter.frequency); lfo.start();
    // The whole drone sits 14 cents flat: the hum of a scale with a wedge under one pan.
    voices = [-14, -7, -19].map((cents) => {
      const o = ac!.createOscillator();
      o.type = cents === -14 ? "sine" : "sawtooth";
      o.frequency.value = NOTES[0]; o.detune.value = cents;
      const g = ac!.createGain(); g.gain.value = cents === -14 ? 0.5 : 0.12;
      o.connect(g).connect(filter); o.start();
      return o;
    });
    filter.connect(master).connect(ac.destination);
  };

  const bell = (freq: number, level: number) => {
    if (!ac || !master || !enabled) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = "triangle"; o.frequency.value = freq;
    g.gain.setValueAtTime(level, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 1.8);
    o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + 1.9);
  };

  return {
    on: () => enabled,
    setOn(on) {
      try {
        if (on && !ac) build();
        enabled = on;
        if (!ac || !master) return;
        if (on) void ac.resume();
        master.gain.setTargetAtTime(on ? 0.05 : 0, ac.currentTime, 0.4);
      } catch (err) {
        console.error("[front door] sound could not start:", err);
        enabled = false;
      }
    },
    facet(i) {
      if (!ac || !enabled) return;
      for (const v of voices) v.frequency.setTargetAtTime(NOTES[i % NOTES.length], ac.currentTime, 0.6);
      bell(NOTES[i % NOTES.length] * 4, 0.05);
    },
    touch(kind) {
      if (kind === "ripple") bell(880 * (1 + Math.random() * 0.5), 0.03);
      if (kind === "hold") bell(55, 0.08);
    },
  };
}
