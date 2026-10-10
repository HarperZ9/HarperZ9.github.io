import os
import sys, pathlib, subprocess, json, copy
ex = pathlib.Path(os.environ.get("EXPLAINER_REPOS", "repos")) / "superstack"
sys.path.insert(0, str(ex))
import superstack as ss
print("canonical:", ss.canonical({"b": 1.0, "a": 1e-7}))
r = ss.rng("folded-light"); print("rng:", [r.nextFloat() if hasattr(r, "nextFloat") else r.next_float() for _ in range(3)])
print("flicks/s", ss.FLICKS_PER_SECOND if hasattr(ss, "FLICKS_PER_SECOND") else None, "per sample 48k", ss.flicks_per_sample(48000), "per sample 44.1k", ss.flicks_per_sample(44100))
for n in dir(ss):
    if "frame" in n.lower() and "flick" in n.lower(): print("fn", n)
scene = {"kind": "superstack.sound/1", "seed": "folded-light", "rate": 48000, "channels": 1, "duration_samples": 4}
pcm = ss.quantize_s16([0.0, 0.25, -0.25, 0.5])
print("pcm bytes", pcm.hex())
rec = ss.make_receipt(producer="my-synth", version="1.0.0", backend="python", scene=scene, content=pcm,
    media={"kind": "audio", "content": "music", "rate": 48000, "channels": 1, "format": "s16le", "frames": 4,
           "duration_flicks": 4 * ss.flicks_per_sample(48000),
           "access": {"autoplay": False, "captions": None, "transcript": False, "reduced_sound": "silent"}},
    does_not_prove=["A PCM hash says nothing about how a device plays the sound."])
print(json.dumps(rec, indent=1)[:1800])
print("verify", ss.verify_receipt(rec))
t = copy.deepcopy(rec); t["identity"] = "MATCH" if rec.get("identity") != "MATCH" else "DRIFT"; print("identity edited", ss.verify_receipt(t))
u = copy.deepcopy(rec); u["does_not_prove"] = []; print("does_not_prove emptied", ss.verify_receipt(u))
print("scene hash", ss.scene_hash(scene) if hasattr(ss, "scene_hash") else None)
for cmd in ([sys.executable, "tests/run_vectors.py"], ["node", "tests/run_vectors.mjs"], [sys.executable, "examples/run_all.py", "--ci"]):
    p = subprocess.run(cmd, cwd=ex, capture_output=True, text=True, encoding="utf-8")
    print("$", " ".join(cmd[1:] if cmd[0] == sys.executable else cmd), "exit", p.returncode); print(p.stdout[-1500:]); print(p.stderr[-300:])
