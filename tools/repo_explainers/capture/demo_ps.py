import sys, pathlib, subprocess, os, tempfile, copy, json
ex = pathlib.Path(os.environ.get("EXPLAINER_REPOS", "repos")) / "proof-surface"
sys.path.insert(0, str(ex / "src"))
from datetime import datetime, timezone
from proof_surface import check_action, validate_authorization_receipt
receipt = {"authorization_version": "0.1", "receipt_id": "ar-demo", "kind": "authorization-grant",
    "principal": {"id": "user:alice@example.com", "role": "project-owner"}, "agent": {"id": "agent:planner"},
    "intent": "Read repository files.", "scope": {"allowed_actions": ["read_file"], "allowed_targets": ["repo:proof-surface"]},
    "granted_at": "2026-06-17T00:00:00Z", "expires_at": "2026-06-19T00:00:00Z", "revoked": False}
now = datetime(2026, 6, 18, tzinfo=timezone.utc)
print("validate", validate_authorization_receipt(receipt))
print("read", check_action(receipt, "read_file", "repo:proof-surface", now=now))
print("delete", check_action(receipt, "delete_file", "repo:proof-surface", now=now))
print("other target", check_action(receipt, "read_file", "repo:other", now=now))
print("expired", check_action(receipt, "read_file", "repo:proof-surface", now=datetime(2026, 6, 20, tzinfo=timezone.utc)))
r2 = copy.deepcopy(receipt); r2["revoked"] = True; print("revoked", check_action(r2, "read_file", "repo:proof-surface", now=now))
r3 = copy.deepcopy(receipt); r3["scope"]["approved"] = True; print("authority key", validate_authorization_receipt(r3)[:2])
w = pathlib.Path(tempfile.mkdtemp())
env = dict(os.environ, PYTHONPATH=str(ex / "src"), PYTHONIOENCODING="utf-8")
p = subprocess.run([sys.executable, "-m", "proof_surface", "visual-measurement", "--input", str(ex / "examples/visual_measurement/measurement.json"),
    "--claim", "sRGB coverage measured on a read-only capture", "--scope", "software capture only, no hardware probe", "--out", str(w / "out")],
    capture_output=True, text=True, env=env, encoding="utf-8", cwd=str(ex))
print("cli exit", p.returncode); print(p.stdout[:1600]); print(p.stderr[-500:])
print(sorted(x.name for x in (w / "out").iterdir()) if (w / "out").exists() else None)
print(open(ex / "examples/visual_measurement/measurement.json").read()[:900])
p = subprocess.run([sys.executable, "-m", "proof_surface", "visual-measurement", "--input", str(ex / "examples/visual_measurement/measurement.json"),
    "--claim", "Display hardware calibrated to sRGB with a colorimeter", "--scope", "full hardware calibration", "--out", str(w / "out2")],
    capture_output=True, text=True, env=env, encoding="utf-8", cwd=str(ex))
print("inflated claim exit", p.returncode); print(p.stdout[:900]); print(p.stderr[-400:])
