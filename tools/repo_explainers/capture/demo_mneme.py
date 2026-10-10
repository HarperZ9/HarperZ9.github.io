import os
import sys, pathlib, json, copy, dataclasses
ex = pathlib.Path(os.environ.get("EXPLAINER_REPOS", "repos")) / "mneme"
sys.path.insert(0, str(ex / "src"))
import mneme
from mneme import AgentMemory
print([n for n in dir(mneme) if not n.startswith("_")])
mem = AgentMemory(":memory:")
s = mem.remember("alice", [
    {"role": "user", "text": "My name is Alice and I live in Portland."},
    {"role": "user", "text": "I prefer tea over coffee and I work in data science."},
    {"role": "assistant", "text": "Noted, Alice."},
    {"role": "user", "text": "I am vegetarian and allergic to shellfish."},
])
print({k: v for k, v in s.items() if k != "provenance"})
for p in s["provenance"]: print(p)
for m in mem.store.memories(layer="L1"): print(m["id"][:12], m["text"], m["source_ids"], {k: m[k] for k in m.keys() if k in ("extractor", "criterion", "content_hash")})
r = mem.recall("tea or coffee preference", strategy="keyword")
for h in r.hits: print("hit", h.memory_id[:12], round(h.fused, 3), getattr(h, "bm25", None), h.text)
print("receipt fields", [f for f in dir(r) if not f.startswith("_")][:30])
try:
    d = r.to_dict() if hasattr(r, "to_dict") else dataclasses.asdict(r)
    print(json.dumps(d, default=str)[:900])
except Exception as e:
    print("dict err", e)
rows = [dict(x) for x in mem.store.memories()]
from mneme import verify_recall
print("verify", verify_recall(r, rows))
r2 = r.as_dict(); r2["hits"][0]["bm25"] = 9.999; r2["hits"][0]["fused"] = 9.999
print("verify tampered score", verify_recall(r2, rows))
rows3 = [dict(x) for x in rows]; rows3[1]["text"] = "I prefer coffee over tea."
print("verify changed store", verify_recall(r, rows3))
print("drift before", json.dumps(mem.drift(), default=str)[:400])
mem.store.add_turn("t-portland", "alice", "user", "My name is Alice and I live in Seattle now.")
atom = mem.store.memories(layer="L1")[0]
mem.store.conn.execute("UPDATE memories SET source_ids=? WHERE id=?", ('["t-portland"]', atom["id"]))
mem.store.conn.commit()
print("drift after", json.dumps(mem.drift(), default=str)[:600])
mid = mem.store.memories(layer="L1")[-1]["id"]
rec = mem.forget(mid, reason="user requested deletion")
print("forget", json.dumps({k: rec[k] for k in ("status", "counts", "findings") if k in rec}, default=str))
a = mem.audit(); print("audit", a["entries"], a["chain_intact"], json.dumps(a.get("log", [])[:1], default=str)[:400])
print("gone", mem.store.memory(mid) is None)
