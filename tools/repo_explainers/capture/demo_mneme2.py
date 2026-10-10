import os
import sys, pathlib, json
sys.path.insert(0, str(pathlib.Path(os.environ.get("EXPLAINER_REPOS", "repos")) / "mneme" / "src"))
from mneme import AgentMemory
def fresh():
    m = AgentMemory(":memory:")
    m.remember("alice", [{"role": "user", "text": "My name is Alice and I live in Portland."},
        {"role": "user", "text": "I prefer tea over coffee and I work in data science."},
        {"role": "assistant", "text": "Noted, Alice."},
        {"role": "user", "text": "I am vegetarian and allergic to shellfish."}])
    return m
m = fresh()
print([r[1] for r in m.store.conn.execute("select * from sqlite_master where type='table'")])
print(m.store.conn.execute("select sql from sqlite_master where name='turns'").fetchone()[0])
m.store.conn.execute("UPDATE turns SET text='My name is Alice and I live in Seattle.' WHERE id='7463dde3257d1778'"); m.store.conn.commit()
d = m.drift(); print("edit source:", d["overall"], [(v["memory_id"][:8], v["verdict"], v["reason"]) for v in d["verdicts"] if v["verdict"] != "MATCH"])
m = fresh()
m.store.conn.execute("DELETE FROM turns WHERE id='d9141c3271ddbb33'"); m.store.conn.commit()
d = m.drift(); print("delete source:", d["overall"], [(v["memory_id"][:8], v["verdict"], v["reason"]) for v in d["verdicts"] if v["verdict"] != "MATCH"])
m = fresh()
m.store.conn.execute("UPDATE memories SET text='I prefer coffee over tea.' WHERE id='04d7a310dd2302b3'"); m.store.conn.commit()
d = m.drift(); print("edit memory row:", d["overall"], [(v["memory_id"][:8], v["verdict"], v["reason"]) for v in d["verdicts"] if v["verdict"] != "MATCH"])
