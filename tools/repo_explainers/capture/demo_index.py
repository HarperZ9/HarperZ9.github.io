import sys, pathlib, subprocess, os, tempfile
ex = pathlib.Path(os.environ.get("EXPLAINER_REPOS", "repos")) / "index"
w = pathlib.Path(tempfile.mkdtemp()) / "shop"
pkg = w / "shop"; pkg.mkdir(parents=True)
CORE = "def price(qty, unit):\n    return qty * unit\n"
(w / "pyproject.toml").write_text('[project]\nname = "shop"\nversion = "0.1.0"\n', encoding="utf-8")
(pkg / "__init__.py").write_text("", encoding="utf-8")
(pkg / "core.py").write_text(CORE, encoding="utf-8", newline="\n")
(pkg / "service.py").write_text("from shop.core import price\n\n\ndef quote(qty):\n    return price(qty, 3)\n", encoding="utf-8", newline="\n")
(pkg / "web.py").write_text("from shop.service import quote\n\n\ndef handler(req):\n    return {'total': quote(req['qty'])}\n", encoding="utf-8", newline="\n")
(w / ".index.toml").write_text("[architecture]\nmax_cycles = 0\n", encoding="utf-8")
env = dict(os.environ, PYTHONPATH=str(ex / "src"), PYTHONIOENCODING="utf-8")
def cli(*a, show=900):
    r = subprocess.run([sys.executable, "-m", "index_graph", *a], capture_output=True, text=True, env=env, cwd=str(w), encoding="utf-8")
    print("$ index", " ".join(a), "-> exit", r.returncode); print(r.stdout[:show].rstrip()); print(r.stderr[-400:].rstrip())
subprocess.run(["git", "init", "-q"], cwd=w); subprocess.run(["git", "add", "-A"], cwd=w)
subprocess.run(["git", "-c", "user.email=x@y", "-c", "user.name=x", "commit", "-qm", "init"], cwd=w)
cli("wiki", "--root", ".", "--out", "wiki.html")
cli("wiki", "--verify", "wiki.html", "--root", ".")
cli("check", "--root", ".", "--internals")
(pkg / "core.py").write_text("from shop.web import handler\n\n\n" + CORE, encoding="utf-8", newline="\n")
cli("internals", "--root", ".", "--cycles")
cli("check", "--root", ".", "--internals")
cli("wiki", "--verify", "wiki.html", "--root", ".")
(pkg / "core.py").write_text(CORE, encoding="utf-8", newline="\n")
cli("wiki", "--verify", "wiki.html", "--root", ".")
(w / "wiki.html").unlink()
cli("wiki", "--verify", "wiki.html", "--root", ".")
