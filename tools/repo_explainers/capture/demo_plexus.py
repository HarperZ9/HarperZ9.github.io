import sys, pathlib, subprocess, os, tempfile, json, shutil
ex = pathlib.Path(os.environ.get("EXPLAINER_REPOS", "repos")) / "plexus"
w = pathlib.Path(tempfile.mkdtemp())
m = w / "m"; m.mkdir()
(m / "notes.interop.json").write_text(json.dumps({"organ": "notes", "invoke": {"cli": "notes"},
    "emits": [{"capability": "notes.summary/1", "title": "summary", "module": "src/notes/summary.py:build"}],
    "consumes": []}), encoding="utf-8")
(m / "review.interop.json").write_text(json.dumps({"organ": "review", "invoke": {"cli": "review"},
    "emits": [{"capability": "review.verdict/1", "title": "verdict", "module": "src/review/verdict.py:judge"}],
    "consumes": [{"capability": "notes.summary/1", "title": "summary intake", "module": "src/review/intake.py:load"},
                 {"capability": "style.guide/1", "title": "style guide", "module": "src/review/style.py:load"}]}), encoding="utf-8")
env = dict(os.environ, PYTHONPATH=str(ex / "src"), PYTHONIOENCODING="utf-8")
def cli(*a, show=1500, out=None):
    r = subprocess.run([sys.executable, "-m", "plexus", *a], capture_output=True, text=True, env=env, cwd=str(w), encoding="utf-8")
    if out: (w / out).write_text(r.stdout, encoding="utf-8")
    print("$ plexus", " ".join(a), "-> exit", r.returncode); print(r.stdout[:show].rstrip()); print(r.stderr[-400:].rstrip())
    return r
r = cli("discover", "--dir", "m", show=2500)
cli("plan", "--dir", "m", "--goal", "review", out="plan.json")
cli("verify", "--plan", "plan.json", "--dir", "m")
p = json.loads((w / "plan.json").read_text()); print("plan keys", list(p.keys()))
p2 = dict(p); p2["order"] = list(reversed(p["order"])); (w / "plan2.json").write_text(json.dumps(p2))
cli("verify", "--plan", "plan2.json", "--dir", "m")
d = json.loads((m / "notes.interop.json").read_text()); d["emits"][0]["capability"] = "notes.summary/2"
(m / "notes.interop.json").write_text(json.dumps(d), encoding="utf-8")
cli("verify", "--plan", "plan.json", "--dir", "m")
cli("route", "--from", "gather", "--to", "crucible", "--builtin")
cli("pick", "summarize these research papers into a digest")
