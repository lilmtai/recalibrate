/** Pure layout helpers for the day timeline (no React). */

export interface Span { id: string; start: number; dur: number }

/**
 * Side-by-side lanes for blocks that overlap. `minDur` is the shortest length a block is drawn at,
 * so two short blocks back to back don't draw on top of each other.
 * Returns each block's lane and the number of lanes in its overlap group.
 */
export function layoutLanes(spans: Span[], minDur = 0): Record<string, { lane: number; of: number }> {
  const sorted = [...spans].sort((a, b) => a.start - b.start || b.dur - a.dur);
  const out: Record<string, { lane: number; of: number }> = {};
  let group: string[] = [];
  let groupEnd = -1;
  let lanes: number[] = [];
  const close = () => { for (const id of group) out[id].of = Math.max(1, lanes.length); };
  for (const s of sorted) {
    const end = s.start + Math.max(s.dur, minDur);
    if (s.start >= groupEnd) { close(); group = []; lanes = []; groupEnd = -1; }
    let i = lanes.findIndex((e) => e <= s.start);
    if (i < 0) { i = lanes.length; lanes.push(0); }
    lanes[i] = end;
    out[s.id] = { lane: i, of: 1 };
    group.push(s.id);
    groupEnd = Math.max(groupEnd, end);
  }
  close();
  return out;
}

/** Free stretches of at least `minGap` minutes between `from` and `to` that no block covers. */
export function freeGaps(spans: Span[], from: number, to: number, minGap = 30): { from: number; to: number }[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const gaps: { from: number; to: number }[] = [];
  let cursor = from;
  for (const s of sorted) {
    if (s.start - cursor >= minGap) gaps.push({ from: cursor, to: Math.min(s.start, to) });
    cursor = Math.max(cursor, s.start + s.dur);
    if (cursor >= to) break;
  }
  if (to - cursor >= minGap) gaps.push({ from: cursor, to });
  return gaps.filter((g) => g.to - g.from >= minGap);
}

/** "45m", "1h", "1h 30m" */
export const lenLabel = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}` : `${m}m`);
