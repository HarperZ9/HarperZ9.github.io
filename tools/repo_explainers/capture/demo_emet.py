import os
import sys, pathlib, subprocess, tempfile, shutil, json
ex = pathlib.Path(os.environ.get("EXPLAINER_REPOS", "repos")) / "emet"
w = pathlib.Path(tempfile.mkdtemp())
def run(*a, inp=None, show=900):
    r = subprocess.run([sys.executable, str(ex / "membrane.py"), *a], cwd=w, capture_output=True, text=True, encoding="utf-8", input=inp)
    print("$ emet", " ".join(a), "-> exit", r.returncode); print(r.stdout[:show].rstrip()); print(r.stderr[-300:].rstrip()); return r
(w / "report.md").write_bytes(b"hello world\n")
run("anchor", "report.md")
run("verify", "report.md")
v = run("verify", "report.md", "--json")
rc = run("receipt", "--from-json", "-", inp=v.stdout)
(w / "receipt.json").write_text(rc.stdout, encoding="utf-8")
run("check", "receipt.json")
d = json.loads(rc.stdout); print("receipt keys", list(d.keys()))
t = json.loads(rc.stdout)
for k in ("verdict", "subject"):
    if k in t: print("field", k, json.dumps(t[k])[:200])
s = rc.stdout.replace('"MATCH"', '"DRIFT"', 1); (w / "tampered.json").write_text(s, encoding="utf-8")
run("check", "tampered.json")
(w / "report.md").write_bytes(b"hello world CHANGED\n")
run("verify", "report.md")
(w / "report.md").unlink()
run("verify", "report.md")
shutil.copy(ex / "examples" / "sample-prompt.txt", w / "prompt.txt")
run("refuse", "prompt.txt")
run("corroborate", "prompt.txt")
(w / "source.txt").write_bytes(b"The total is 41 seconds.\n"); (w / "view.txt").write_bytes(b"The total is 14 seconds.\n")
run("coherence", "source.txt", "view.txt")
run("audit")
