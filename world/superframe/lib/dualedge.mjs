// dualedge.mjs: the dual-edge check (Synthesis-and-Design-Framework.md section 5; CONSENSUS section 1).
// A node marked with edge.persuasion is a perception trick. Shown alone it is a dark pattern; shown with its reveal
// it lets a person catch their own perception being steered. A compiled plan passes only when every persuasion node
// has one of its counterpart nodes downstream of it, and that counterpart reaches a recipe output.

export function dualEdge(plan) {
  const down = new Map(); // id -> ids that consume it
  for (const inst of plan.order) for (const r of Object.values(inst.in)) { if (!down.has(r.id)) down.set(r.id, []); down.get(r.id).push(inst.id); }
  const reach = id => { const seen = new Set(), st = [id]; while (st.length) { const x = st.pop(); for (const y of down.get(x) ?? []) if (!seen.has(y)) { seen.add(y); st.push(y); } } return seen; };
  const outIds = new Set(Object.values(plan.outs).map(o => o.id));
  const feedsOut = id => outIds.has(id) || [...reach(id)].some(x => outIds.has(x));
  const problems = [];
  for (const inst of plan.order) {
    // an edge with an empty counterpart list is named (documented both ways) but needs no reveal in the output
    const e = inst.def.edge; if (!e?.persuasion || !e.counterpart?.length) continue;
    const below = reach(inst.id);
    const ok = plan.order.some(c => below.has(c.id) && e.counterpart.includes(c.def.id) && feedsOut(c.id));
    if (!ok) problems.push(`${inst.id} (${inst.def.id}) is a perception trick (${e.persuasion}) and its reveal (${e.counterpart.join(' or ')}) does not reach an output`);
  }
  return { pass: problems.length === 0, problems };
}
