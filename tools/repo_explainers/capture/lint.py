"""Extract the prose of a built explainer and run both writing linters over it."""
import html, re, subprocess, sys, pathlib, os
here = pathlib.Path(__file__).parent
ex = pathlib.Path(os.environ.get("EXPLAINER_REPOS", "repos"))
name = sys.argv[1]
src = (here.parent / "out" / f"{name}.html").read_text(encoding="utf-8")
body = re.sub(r"<script.*?</script>|<style.*?</style>|<pre.*?</pre>|<code>.*?</code>", " ", src, flags=re.S)
blocks = re.findall(r"<(?:p|li|h[1-3]|summary)[^>]*>(.*?)</(?:p|li|h[1-3]|summary)>", body, flags=re.S)
text = "\n\n".join(html.unescape(re.sub(r"<[^>]+>", "", b)).strip() for b in blocks)
text = re.sub(r"[ \t]+", " ", text)
out = here / "out" / f"{name}.prose.md"
out.write_text(text, encoding="utf-8")
env = dict(os.environ, PYTHONPATH=str(ex / "articulate" / "src"), PYTHONIOENCODING="utf-8")
for prof in ("readme",):
    r = subprocess.run([sys.executable, "-m", "articulate.cli", "check", str(out), "--profile", prof, "--verbose"],
                       env=env, capture_output=True, text=True, encoding="utf-8")
    print(r.stdout[-4000:], r.stderr[-1500:])
r = subprocess.run([sys.executable, str(ex / "flywheel" / "scripts" / "check_writing.py"), "--profile", "readme", str(out)],
                   capture_output=True, text=True, encoding="utf-8", env=env, cwd=str(ex / "flywheel"))
print(r.stdout[-4000:], r.stderr[-1500:])
