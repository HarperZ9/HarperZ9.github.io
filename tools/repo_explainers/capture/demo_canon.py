import sys, pathlib, subprocess, os, tempfile
ex = pathlib.Path(os.environ.get("EXPLAINER_REPOS", "repos")) / "canon"
base = pathlib.Path(tempfile.mkdtemp())
repo = base / "exporter"; repo.mkdir()
home = base / "home"; home.mkdir()
env = dict(os.environ, PYTHONPATH=str(ex / "src"), PYTHONIOENCODING="utf-8", CANON_HOME=str(home), HOME=str(home), USERPROFILE=str(home))
g = lambda *a: subprocess.run(["git", *a], cwd=repo, capture_output=True, text=True)
g("init", "-q"); g("config", "canon.project", "exporter")
(repo / "export.py").write_text("def to_csv(rows):\n    return '\\n'.join(','.join(r) for r in rows)\n", encoding="utf-8")
g("add", "-A"); g("-c", "user.email=x@y", "-c", "user.name=x", "commit", "-qm", "init")
def cli(*a, show=1400):
    r = subprocess.run([sys.executable, "-m", "canon", *a], capture_output=True, text=True, env=env, cwd=str(repo), encoding="utf-8")
    print("$ canon", " ".join(a), "-> exit", r.returncode); print(r.stdout[:show].rstrip()); print(r.stderr[-500:].rstrip())
    return r
cli("workspace", "focus", "--goal", "Ship the JSON export", "--area", "src/export")
cli("workspace", "decide", "--title", "Keep the CSV writer", "--decision", "Add JSON beside CSV", "--context", "Downstream scripts parse CSV", "--reject", "Replace CSV", "breaks three scripts")
cli("workspace", "decide", "--title", "Drop CSV", "--decision", "JSON only", "--context", "simpler", "--reject", "Keep CSV")
cli("workspace", "decide", "--title", "Use the token", "--decision", "export with api_key=sk-live-abcdef1234567890abcdef", "--context", "ci")
cli("handoff", "--to", "codex")
cli("switch", "--to", "codex", "--create")
agents = repo / "AGENTS.md"
print("AGENTS.md exists", agents.exists()); print(agents.read_text(encoding="utf-8")[:1500] if agents.exists() else "")
if agents.exists():
    t = agents.read_text(encoding="utf-8"); agents.write_text(t.replace("Ship the JSON export", "Ship the XML export", 1), encoding="utf-8")
    cli("switch", "--to", "codex")
    cli("workspace", "list", "--proposed")
