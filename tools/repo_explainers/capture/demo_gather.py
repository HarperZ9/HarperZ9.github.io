import sys, pathlib, json, subprocess, os, tempfile, shutil
ex = pathlib.Path(os.environ.get("EXPLAINER_REPOS", "repos")) / "gather"
sys.path.insert(0, str(ex / "src"))
from gather.schema_extract import verify_record
w = pathlib.Path(tempfile.mkdtemp())
page = ("<html><body><h1>Aperiodic monotile</h1>"
        "<p>The hat tile was announced in 2023 and tiles the plane with 1000 copies shown in the figure.</p>"
        "<p>Authors: Smith, Myers, Kaplan, Goodman-Strauss.</p></body></html>")
(w / "article.html").write_text(page, encoding="utf-8", newline="\n")
env = dict(os.environ, PYTHONPATH=str(ex / "src"), PYTHONIOENCODING="utf-8")
def cli(*a):
    r = subprocess.run([sys.executable, "-m", "gather", *a], capture_output=True, text=True, env=env, cwd=str(w), encoding="utf-8")
    return r
r = cli("extract", "article.html"); print("extract exit", r.returncode); print(r.stdout[:1800]); print(r.stderr[-400:])
r = cli("markdown", "article.html"); print("markdown:", r.stdout)
for rec in ({"title": "Aperiodic monotile", "year": "2023", "copies": "1000"},
            {"title": "Aperiodic monotile", "year": "2023", "copies": "100"},
            {"title": "Aperiodic monotile", "year": "2024"}):
    v = verify_record(page, rec)
    print(rec, "->", [(f.field, f.value, f.grounded) if hasattr(f, "field") else f for f in v.fields] if hasattr(v, "fields") else v)
r = cli("docs", str(w), "--store", str(w / "corpus")); print("docs exit", r.returncode, r.stdout[:600], r.stderr[-300:])
r = cli("corpus", "verify", str(w / "corpus")); print("verify exit", r.returncode, r.stdout[:600], r.stderr[-300:])
bodies = [p for p in (w / "corpus").rglob("*") if p.is_file() and "bod" in str(p).lower()]
print("bodies", [str(b.relative_to(w)) for b in bodies][:5])
