import sys, pathlib, subprocess, os, tempfile
ex = pathlib.Path(os.environ.get("EXPLAINER_REPOS", "repos")) / "gather"
w = pathlib.Path(tempfile.mkdtemp()); n = w / "notes"; n.mkdir()
(n / "monotile.md").write_text("# Aperiodic monotile\n\nThe hat tile tiles the plane but never periodically.\n", encoding="utf-8", newline="\n")
(n / "rubik.md").write_text("# Rubik's cube\n\nThe cube group has 43252003274489856000 elements.\n", encoding="utf-8", newline="\n")
env = dict(os.environ, PYTHONPATH=str(ex / "src"), PYTHONIOENCODING="utf-8")
def cli(*a):
    r = subprocess.run([sys.executable, "-m", "gather", *a], capture_output=True, text=True, env=env, cwd=str(w), encoding="utf-8")
    print("$ gather", " ".join(a).replace(str(w), "."), "-> exit", r.returncode); print(r.stdout.replace(str(w), ".")[:900]); print(r.stderr[-300:])
cli("docs", "notes", "--store", "corpus")
cli("docs", "notes", "--store", "corpus")
cli("corpus", "verify", "corpus")
files = sorted(p for p in (w / "corpus").rglob("*") if p.is_file())
print([str(p.relative_to(w)) for p in files])
body = [p for p in files if p.suffix not in (".json", ".jsonl", ".db", ".sqlite")]
print("candidate bodies", [str(p.relative_to(w)) for p in body])
if body:
    b = body[0]; data = b.read_bytes(); b.write_bytes(data.replace(b"never", b"often", 1) if b"never" in data else data + b"x")
    cli("corpus", "verify", "corpus")
    body[-1].unlink(); cli("corpus", "verify", "corpus")
cli("docs", "notes", "--scope", "monotile")
