import sys, json, pathlib, subprocess, os
ex = pathlib.Path(os.environ.get("EXPLAINER_REPOS", "repos"))
sys.path.insert(0, str(ex / "articulate" / "src"))
import articulate
from articulate import profiles, receipt as R, detector
text = ("# A note on the redesign\n\n"
        "We leverage cutting-edge tools to make the app fast, cheap, and reliable. "
        "This is not a feature, but a philosophy. Moreover, the results speak for themselves: "
        "a small change — and a large payoff.\n\n"
        "I wrote the rest by hand. The build takes 41 seconds on the CI runner, down from 58.\n")
work = pathlib.Path(__file__).parent / "artwork"; work.mkdir(exist_ok=True)
(work / "post.md").write_text(text, encoding="utf-8", newline="\n")
for name in ("narrative", "readme", "procedure"):
    r = articulate.check_text(text, profile=profiles.load(name))
    print(name, r["slop"], r["gate"], r["blocking_count"], r["verdict"], r["texture_score"],
          [(f["tier"], f["category"], f["match"]) for f in r["high"] + r["medium"] + r["low"]])
r = articulate.check_text(text, profile=profiles.load("readme"))
print("words", r["cadence"]["words"], "soft", r.get("soft"))
env = dict(os.environ, PYTHONPATH=str(ex / "articulate" / "src"), PYTHONIOENCODING="utf-8")
cli = lambda *a: subprocess.run([sys.executable, "-m", "articulate.cli", *a], env=env, capture_output=True, text=True, encoding="utf-8", cwd=str(work))
p = cli("check", "post.md", "--profile", "readme", "--spans"); print(p.stdout)
p = cli("check", "post.md", "--profile", "readme", "--gate"); print(p.stdout, "exit", p.returncode)
rec = cli("receipt", "post.md", "--profile", "readme").stdout
(work / "post.receipt.json").write_text(rec, encoding="utf-8", newline="\n")
p = cli("verify", "post.receipt.json", "post.md"); print(p.stdout.strip(), "exit", p.returncode)
d = json.loads(rec)
for label, mut in (("gate->ok", lambda x: x.__setitem__("gate", "ok")),
                   ("drop finding", lambda x: x.__setitem__("findings", x["findings"][:-1])),
                   ("ruleset", lambda x: x.__setitem__("ruleset_version", "sha256:0000000000000000"))):
    t = json.loads(rec); mut(t)
    (work / "t.json").write_text(json.dumps(t), encoding="utf-8")
    p = cli("verify", "t.json", "post.md"); print(label, "|", p.stdout.strip(), "exit", p.returncode)
(work / "post2.md").write_text(text.replace("Moreover", "And"), encoding="utf-8", newline="\n")
p = cli("verify", "post.receipt.json", "post2.md"); print("edited text |", p.stdout.strip(), "exit", p.returncode)
fixed = ("# A note on the redesign\n\n"
         "We rebuilt the app on three tools we already knew. It loads in half the time and costs less to host. "
         "The change was small and the payoff was large.\n\n"
         "I wrote the rest by hand. The build takes 41 seconds on the CI runner, down from 58.\n")
(work / "fixed.md").write_text(fixed, encoding="utf-8", newline="\n")
p = cli("check", "fixed.md", "--profile", "readme", "--gate", "--verbose"); print(p.stdout, "exit", p.returncode)
print(json.dumps({k: d[k] for k in ("schema", "articulate_version", "ruleset_version", "profile", "text_sha256", "gate", "verdict", "texture_score", "counts")}, indent=1))
