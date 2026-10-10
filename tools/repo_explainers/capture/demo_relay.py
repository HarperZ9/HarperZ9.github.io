import sys, pathlib, tempfile, json, subprocess, os
ex = pathlib.Path(os.environ.get("EXPLAINER_REPOS", "repos")) / "relay"
sys.path.insert(0, str(ex / "src"))
from relay.local_tools import ToolExecutor, ToolGate
from relay.local_session import SessionLedger
from relay.hashline import line_anchor

root = pathlib.Path(tempfile.mkdtemp())
src = "def paginate(items, page, size):\n    start = page * size\n    end = start + size - 1\n    return items[start:end]\n"
(root / "pager.py").write_text(src, encoding="utf-8", newline="\n")
ro = ToolExecutor(root=str(root))
rw = ToolExecutor(root=str(root), gate=ToolGate(allow_write=True))
def show(label, r): print(f"--- {label}: ok={r.ok}\n{r.output}")
show("read hashed", ro.execute("read_file", {"path": "pager.py", "hashed": True}))
a3 = line_anchor(3, "    end = start + size - 1")
show("edit_lines without --allow-write", ro.execute("edit_lines", {"path": "pager.py", "at": a3, "new": "    end = start + size"}))
show("edit_lines fresh anchor", rw.execute("edit_lines", {"path": "pager.py", "at": a3, "new": "    end = start + size"}))
show("edit_lines same anchor again (stale)", rw.execute("edit_lines", {"path": "pager.py", "at": a3, "new": "    end = start + size"}))
print(open(root / "pager.py").read())
(root / "dup.py").write_text("x = 1\nx = 1\n", encoding="utf-8")
show("edit_file ambiguous", rw.execute("edit_file", {"path": "dup.py", "old": "x = 1", "new": "x = 2"}))
bad = "--- a/pager.py\n+++ b/pager.py\n@@ -2,2 +2,2 @@\n     start = page * size\n-    end = start + size - 1\n+    end = start + size\n"
show("apply_diff with stale context", rw.execute("apply_diff", {"path": "pager.py", "diff": bad}))
show("read escape", ro.execute("read_file", {"path": "../../etc/passwd"}))
show("run without exec", rw.execute("run", {"cmd": "pytest -q"}))
L = SessionLedger()
L.append("user", "fix the off-by-one in paginate()")
L.append("tool_call", "read_file pager.py", {"hashed": True})
L.append("tool_call", "edit_lines pager.py", {"at": a3})
L.append("tool_result", "edited pager.py (replace " + a3 + ")")
for e in L.entries: print(e.seq, e.kind, e.prev_hash[:12], e.entry_hash[:12])
print("verify", L.verify(), "checkpoint", L.checkpoint()[:16])
p = root / "run.jsonl"; L.save(str(p))
t = p.read_text(encoding="utf-8").replace("edit_lines pager.py", "edit_lines auth.py")
p2 = root / "run2.jsonl"; p2.write_text(t, encoding="utf-8")
try:
    SessionLedger.load(str(p2)); print("tampered load: accepted")
except ValueError as e:
    print("tampered load refused:", e)
env = dict(os.environ, PYTHONPATH=str(ex / "src"))
for args in (["--probe-injection"], ["--probe-injection", "--allow-exec"]):
    r = subprocess.run([sys.executable, "-m", "relay", *args], capture_output=True, text=True, env=env, cwd=str(root))
    d = json.loads(r.stdout)
    print(args, "exit", r.returncode, d["contained"], "/", d["total"], d["receipt"], [(x["id"], x["contained"], x["detail"]) for x in d["results"]])
