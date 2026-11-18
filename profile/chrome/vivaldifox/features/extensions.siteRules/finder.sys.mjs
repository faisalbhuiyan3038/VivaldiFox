/* MPL-2.0. The search behind "Find Problem Extension": a binary search driven
 * by the user's answer to "does the site work with these extensions off?". */

const firstHalf = list => list.slice(0, Math.ceil(list.length / 2));

function narrow(all, candidates) {
  return candidates.length === 1
    ? { phase: "verify", all, candidates, blocked: candidates }
    : { phase: "search", all, candidates, blocked: firstHalf(candidates) };
}

/** Start by turning everything off, to learn whether an extension is involved at all. */
export function begin(ids) {
  return { phase: "confirm", all: ids, candidates: ids, blocked: ids };
}

/** The next step, or a result: { done: "found" | "outside" | "multiple", id?, all }. */
export function advance(state, works) {
  const { phase, all, candidates, blocked } = state;
  if (phase === "confirm") {
    if (!works) return { done: "outside", all };
    return candidates.length === 1 ? { done: "found", id: candidates[0], all } : narrow(all, candidates);
  }
  if (phase === "verify") {
    return works ? { done: "found", id: candidates[0], all } : { done: "multiple", all };
  }
  return narrow(all, works ? blocked : candidates.filter(id => !blocked.includes(id)));
}
